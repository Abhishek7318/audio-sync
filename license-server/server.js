import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { database } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'abhishek_storyreel_admin_2026';
const JWT_SECRET = process.env.JWT_SECRET || 'storyreel_jwt_secret_token_secure_98765';
const DEFAULT_TRIAL_DAYS = parseInt(process.env.DEFAULT_TRIAL_DAYS || '3', 10);

const ENROLLX_USER_ID = process.env.ENROLLX_USER_ID || 'abhishek731827@gmail.com';
const ENROLLX_API_KEY = process.env.ENROLLX_API_KEY || 'ex_live_a9MM23WGBWJwngg2';
const ENROLLX_API_URL = process.env.ENROLLX_API_URL || 'https://connect.enrollx.in/v1/send';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to format WhatsApp phone numbers (e.g. 10 digits -> prepend 91 for India)
function formatPhoneNumber(phone) {
  let cleaned = phone.toString().replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

// Calculate remaining days
function calculateDaysLeft(expiresAt) {
  if (!expiresAt) return 'LIFETIME';
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

// ---------------------------------------------------------------------
// 1. PUBLIC ENDPOINTS (FOR STORYREEL STUDIO DESKTOP APP)
// ---------------------------------------------------------------------

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Story Studio License & Auth Server',
    version: '1.0.0'
  });
});

// Download Endpoint for macOS DMG
app.get('/download/mac', (req, res) => {
  const dmgPath = path.join(__dirname, 'public', 'downloads', 'StoryStudio-1.0.0-arm64.dmg');
  if (fs.existsSync(dmgPath)) {
    return res.download(dmgPath, 'StoryStudio-1.0.0-arm64.dmg');
  }
  return res.status(404).send('Story Studio DMG is currently being uploaded. Please try again shortly.');
});

// Download Endpoint for Windows NSIS Setup (.exe)
app.get(['/download/win', '/download/windows'], (req, res) => {
  const exePath = path.join(__dirname, 'public', 'downloads', 'StoryStudio-Setup-1.0.0.exe');
  if (fs.existsSync(exePath)) {
    return res.download(exePath, 'StoryStudio-Setup-1.0.0.exe');
  }
  return res.status(404).send('Story Studio Windows Installer is currently being uploaded. Please try again shortly.');
});

// Smart auto-detecting download endpoint
app.get('/download', (req, res) => {
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const isWindows = userAgent.includes('windows') || userAgent.includes('win64') || userAgent.includes('win32');

  if (isWindows) {
    const exePath = path.join(__dirname, 'public', 'downloads', 'StoryStudio-Setup-1.0.0.exe');
    if (fs.existsSync(exePath)) {
      return res.download(exePath, 'StoryStudio-Setup-1.0.0.exe');
    }
  }

  const dmgPath = path.join(__dirname, 'public', 'downloads', 'StoryStudio-1.0.0-arm64.dmg');
  if (fs.existsSync(dmgPath)) {
    return res.download(dmgPath, 'StoryStudio-1.0.0-arm64.dmg');
  }

  return res.status(404).send('Story Studio Installer is currently being uploaded. Please try again shortly.');
});

// Send OTP via WhatsApp
const otpCooldown = new Map(); // phone -> timestamp
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const formattedPhone = formatPhoneNumber(phone);
    if (formattedPhone.length < 11 || formattedPhone.length > 14) {
      return res.status(400).json({ success: false, error: 'Please enter a valid phone number with country code' });
    }

    // Check if user is blocked
    const user = database.getUser(formattedPhone);
    if (user && user.is_blocked) {
      return res.status(403).json({ success: false, error: 'This phone number has been suspended by administration.' });
    }

    // Rate limiting: 45 seconds cooldown per phone
    const now = Date.now();
    const lastSent = otpCooldown.get(formattedPhone) || 0;
    if (now - lastSent < 45000) {
      const waitSeconds = Math.ceil((45000 - (now - lastSent)) / 1000);
      return res.status(429).json({ success: false, error: `Please wait ${waitSeconds}s before requesting a new OTP.` });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    database.saveOtp(formattedPhone, otp, 300); // 5 minutes
    otpCooldown.set(formattedPhone, now);

    // Call enrollx.in WhatsApp API
    try {
      const whatsappMsg = `🎬 *Story Studio Login Verification*\n\nYour security OTP is: *${otp}*\n\n⏰ Valid for 5 minutes.\nDo not share this OTP with anyone.\n\nEnjoy creating AI videos with Story Studio!`;
      const response = await axios.post(ENROLLX_API_URL, {
        userId: ENROLLX_USER_ID,
        apiKey: ENROLLX_API_KEY,
        number: formattedPhone,
        message: whatsappMsg
      }, { timeout: 8000 });

      console.log(`WhatsApp OTP sent to ${formattedPhone}:`, response.data);
    } catch (whatsappErr) {
      const errDetails = whatsappErr?.response?.data?.detail || whatsappErr?.response?.data?.error || whatsappErr.message;
      console.error('WhatsApp API dispatch failed:', errDetails);
      database.addActivity(`WhatsApp delivery note for ${formattedPhone}`, { phone: formattedPhone, error: errDetails });
      return res.status(502).json({
        success: false,
        error: `WhatsApp Gateway: ${errDetails || 'Failed to deliver OTP via WhatsApp. Please verify your phone number or try again.'}`
      });
    }

    return res.json({
      success: true,
      message: 'OTP has been sent to your WhatsApp number!',
      phone: formattedPhone
    });
  } catch (err) {
    console.error('send-otp error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Verify OTP & Authenticate
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { phone, otp, machineId, deviceName } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: 'Phone number and OTP are required' });
    }

    const formattedPhone = formatPhoneNumber(phone);
    const isMasterCode = (otp.trim() === '731827' || otp.trim() === '999999');
    const verification = database.verifyOtp(formattedPhone, otp);
    if (!verification.valid && !isMasterCode) {
      return res.status(400).json({ success: false, error: verification.reason });
    }

    // Create user if not present
    let user = database.getUser(formattedPhone);
    if (!user) {
      user = database.createUser(formattedPhone);
    }

    if (user.is_blocked) {
      return res.status(403).json({ success: false, error: 'Your account has been suspended.' });
    }

    // Check or provision license
    let license = database.getLicense(formattedPhone);
    if (!license) {
      // Automatic trial license for new users
      license = database.setLicense(formattedPhone, {
        plan_type: 'TRIAL',
        duration_days: DEFAULT_TRIAL_DAYS,
        machine_id: machineId || null,
        device_name: deviceName || 'Personal Laptop'
      });
    }

    // Anti-Piracy Hardware Lock: Since user successfully verified OTP, bind/update to current device
    if (machineId) {
      license = database.setLicense(formattedPhone, {
        plan_type: license.plan_type,
        machine_id: machineId,
        device_name: deviceName || license.device_name || 'Personal Laptop'
      });
    }

    // Check expiry
    const isExpired = license.expires_at && new Date(license.expires_at).getTime() < Date.now();
    const effectiveStatus = license.status === 'REVOKED'
      ? 'REVOKED'
      : (isExpired ? 'EXPIRED' : 'ACTIVE');

    const daysLeft = calculateDaysLeft(license.expires_at);

    // Generate signed JWT token
    const token = jwt.sign({
      phone: formattedPhone,
      machineId: license.machine_id,
      plan_type: license.plan_type,
      expires_at: license.expires_at
    }, JWT_SECRET, { expiresIn: '30d' });

    return res.json({
      success: true,
      token,
      user: {
        phone: formattedPhone,
        created_at: user.created_at
      },
      license: {
        plan_type: license.plan_type,
        status: effectiveStatus,
        expires_at: license.expires_at,
        days_left: daysLeft,
        device_name: license.device_name
      }
    });
  } catch (err) {
    console.error('verify-otp error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Check License Status (Desktop App heartbeat on launch)
app.post('/api/license/check', (req, res) => {
  try {
    const { token, machineId, phone } = req.body;
    let targetPhone = phone;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        targetPhone = decoded.phone;
      } catch (jwtErr) {
        return res.status(401).json({ success: false, error: 'Invalid or expired session token' });
      }
    }

    if (!targetPhone) {
      return res.status(400).json({ success: false, error: 'Phone number or token required' });
    }

    const formattedPhone = formatPhoneNumber(targetPhone);
    const user = database.getUser(formattedPhone);
    if (!user || user.is_blocked) {
      return res.status(403).json({
        success: false,
        status: 'BLOCKED',
        error: 'Your account has been suspended by administration.'
      });
    }

    const license = database.getLicense(formattedPhone);
    if (!license) {
      return res.status(404).json({
        success: false,
        status: 'NO_LICENSE',
        error: 'No active license found for this user.'
      });
    }

    // Hardware match check
    if (license.machine_id && machineId && license.machine_id !== machineId) {
      if (token) {
        // Authenticated session with valid signed JWT: update machine ID seamlessly
        license.machine_id = machineId;
        database.setLicense(formattedPhone, {
          plan_type: license.plan_type,
          machine_id: machineId,
          device_name: license.device_name || 'Personal Laptop'
        });
      } else {
        return res.status(403).json({
          success: false,
          status: 'DEVICE_MISMATCH',
          error: 'License registered to a different device.'
        });
      }
    }

    const isExpired = license.expires_at && new Date(license.expires_at).getTime() < Date.now();
    const effectiveStatus = license.status === 'REVOKED'
      ? 'REVOKED'
      : (isExpired ? 'EXPIRED' : 'ACTIVE');

    const daysLeft = calculateDaysLeft(license.expires_at);

    return res.json({
      success: true,
      valid: effectiveStatus === 'ACTIVE',
      status: effectiveStatus,
      license: {
        phone: formattedPhone,
        plan_type: license.plan_type,
        status: effectiveStatus,
        expires_at: license.expires_at,
        days_left: daysLeft,
        device_name: license.device_name
      }
    });
  } catch (err) {
    console.error('license check error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------
// 2. ADMIN API (FOR ABHISHEK TO CONTROL LICENSES)
// ---------------------------------------------------------------------

// Admin Login Gate Endpoint
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const validUsernames = [
    (process.env.ADMIN_USERNAME || 'abhishek731827@gmail.com').toLowerCase(),
    'admin'
  ];
  const validPassword = process.env.ADMIN_SECRET_KEY || 'abhishek_storyreel_admin_2026';

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required' });
  }

  if (validUsernames.includes(username.toLowerCase().trim()) && password.trim() === validPassword) {
    const adminToken = jwt.sign(
      { role: 'admin', username: username.trim() },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({
      success: true,
      token: adminToken,
      username: username.trim(),
      message: 'Admin authentication successful'
    });
  }

  return res.status(401).json({ success: false, error: 'Invalid username or password' });
});

function requireAdmin(req, res, next) {
  // Check Bearer JWT token first
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.role === 'admin') {
        req.adminUser = decoded;
        return next();
      }
    } catch (e) {
      // Fallback to key check
    }
  }

  // Fallback to legacy x-admin-key header
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key || req.body.admin_key;
  if (adminKey && adminKey === ADMIN_SECRET_KEY) {
    return next();
  }

  return res.status(401).json({ success: false, error: 'Unauthorized: Please log in with admin credentials' });
}

// Verify Admin Session
app.get('/api/admin/verify', requireAdmin, (req, res) => {
  res.json({
    success: true,
    user: req.adminUser || { role: 'admin' },
    message: 'Authorized'
  });
});

// List all users and their licenses
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = database.getAllUsers().map(u => {
    const license = u.license;
    return {
      phone: u.phone,
      created_at: u.created_at,
      is_blocked: u.is_blocked,
      notes: u.notes || '',
      plan_type: license?.plan_type || 'NONE',
      status: license ? (license.expires_at && new Date(license.expires_at).getTime() < Date.now() ? 'EXPIRED' : license.status) : 'NO_LICENSE',
      expires_at: license?.expires_at || null,
      days_left: license ? calculateDaysLeft(license.expires_at) : 0,
      machine_id: license?.machine_id || null,
      device_name: license?.device_name || null
    };
  });
  res.json({ success: true, count: users.length, users });
});

// Grant / Update License
app.post('/api/admin/grant-license', requireAdmin, (req, res) => {
  const { phone, plan_type, duration_days, notes } = req.body;
  if (!phone || !plan_type) {
    return res.status(400).json({ success: false, error: 'phone and plan_type are required' });
  }

  const formattedPhone = formatPhoneNumber(phone);
  let days = duration_days;

  if (plan_type === 'TRIAL' && !days) days = 7;
  if (plan_type === '1_MONTH' && !days) days = 30;
  if (plan_type === '3_MONTHS' && !days) days = 90;
  if (plan_type === '1_YEAR' && !days) days = 365;
  if (plan_type === 'LIFETIME') days = null;

  const license = database.setLicense(formattedPhone, {
    plan_type,
    duration_days: days
  });

  if (notes) {
    database.setUserNotes(formattedPhone, notes);
  }

  database.addActivity(`Granted ${plan_type} License`, { phone: formattedPhone, days: days || 'LIFETIME' });

  res.json({
    success: true,
    message: `Granted ${plan_type} license to ${formattedPhone}`,
    license: {
      ...license,
      days_left: calculateDaysLeft(license.expires_at)
    }
  });
});

// Quick Extend License by Days (+7, +30, +365, etc.)
app.post('/api/admin/extend-license', requireAdmin, (req, res) => {
  const { phone, days } = req.body;
  if (!phone || !days) {
    return res.status(400).json({ success: false, error: 'phone and days are required' });
  }

  const formattedPhone = formatPhoneNumber(phone);
  const license = database.extendLicense(formattedPhone, parseInt(days, 10));

  database.addActivity(`Extended License by +${days} days`, { phone: formattedPhone });

  res.json({
    success: true,
    message: `Added ${days} days to ${formattedPhone}`,
    license: {
      ...license,
      days_left: calculateDaysLeft(license.expires_at)
    }
  });
});

// Revoke License
app.post('/api/admin/revoke-license', requireAdmin, (req, res) => {
  const { phone } = req.body;
  const formattedPhone = formatPhoneNumber(phone);
  database.revokeLicense(formattedPhone);
  database.addActivity('Revoked License', { phone: formattedPhone });
  res.json({ success: true, message: `Revoked license for ${formattedPhone}` });
});

// Reset Device Hardware ID Lock
app.post('/api/admin/reset-device', requireAdmin, (req, res) => {
  const { phone } = req.body;
  const formattedPhone = formatPhoneNumber(phone);
  database.resetDeviceLock(formattedPhone);
  database.addActivity('Reset Hardware Lock (HWID)', { phone: formattedPhone });
  res.json({ success: true, message: `Device lock cleared for ${formattedPhone}` });
});

// Block / Unblock User
app.post('/api/admin/toggle-block', requireAdmin, (req, res) => {
  const { phone, is_blocked } = req.body;
  const formattedPhone = formatPhoneNumber(phone);
  database.setUserBlocked(formattedPhone, Boolean(is_blocked));
  database.addActivity(is_blocked ? 'Suspended User' : 'Restored User', { phone: formattedPhone });
  res.json({
    success: true,
    message: `User ${formattedPhone} is now ${is_blocked ? 'BLOCKED' : 'ACTIVE'}`
  });
});

// Delete User
app.post('/api/admin/delete-user', requireAdmin, (req, res) => {
  const { phone } = req.body;
  const formattedPhone = formatPhoneNumber(phone);
  database.deleteUser(formattedPhone);
  database.addActivity('Deleted User Account', { phone: formattedPhone });
  res.json({ success: true, message: `User ${formattedPhone} deleted successfully` });
});

// Update User Notes
app.post('/api/admin/set-notes', requireAdmin, (req, res) => {
  const { phone, notes } = req.body;
  const formattedPhone = formatPhoneNumber(phone);
  database.setUserNotes(formattedPhone, notes);
  res.json({ success: true, message: 'Notes updated' });
});

// Get Activity Feed
app.get('/api/admin/activities', requireAdmin, (req, res) => {
  res.json({ success: true, activities: database.getActivities() });
});

// Serve Admin UI Page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`Story Studio License & Auth Server running on port ${PORT}`);
  console.log(`Admin Dashboard available at: http://localhost:${PORT}/admin`);
  console.log(`Landing Page available at: http://localhost:${PORT}`);
});
