import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = {
  users: {},     // phone -> { phone, created_at, is_blocked }
  licenses: {},  // phone -> { phone, plan_type, status, expires_at, machine_id, device_name, updated_at }
  otps: {}       // phone -> { otp, expires_at, attempts }
};

function load() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(content);
      if (!db.users) db.users = {};
      if (!db.licenses) db.licenses = {};
      if (!db.otps) db.otps = {};
    } catch (e) {
      console.error('Failed to parse database.json, initializing fresh store:', e);
    }
  } else {
    save();
  }
}

function save() {
  try {
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

// Initial load
load();

export const database = {
  // Users
  getUser(phone) {
    return db.users[phone] || null;
  },
  createUser(phone, meta = {}) {
    if (!db.users[phone]) {
      db.users[phone] = {
        phone,
        created_at: new Date().toISOString(),
        is_blocked: false,
        ...meta
      };
      save();
    }
    return db.users[phone];
  },
  setUserBlocked(phone, is_blocked) {
    if (db.users[phone]) {
      db.users[phone].is_blocked = is_blocked;
      save();
      return true;
    }
    return false;
  },
  getAllUsers() {
    return Object.values(db.users).map(user => {
      const license = db.licenses[user.phone] || null;
      return {
        ...user,
        license
      };
    });
  },

  // Licenses
  getLicense(phone) {
    return db.licenses[phone] || null;
  },
  setLicense(phone, { plan_type, duration_days = null, machine_id = null, device_name = null }) {
    let expires_at = null;
    if (plan_type === 'LIFETIME') {
      expires_at = null;
    } else if (duration_days) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + duration_days);
      expires_at = expDate.toISOString();
    }

    const existing = db.licenses[phone] || {};
    db.licenses[phone] = {
      phone,
      plan_type,
      status: 'ACTIVE',
      expires_at,
      machine_id: machine_id !== undefined ? machine_id : (existing.machine_id || null),
      device_name: device_name || existing.device_name || 'Personal Laptop',
      updated_at: new Date().toISOString()
    };

    // Ensure user exists
    if (!db.users[phone]) {
      db.users[phone] = {
        phone,
        created_at: new Date().toISOString(),
        is_blocked: false
      };
    }

    save();
    return db.licenses[phone];
  },
  extendLicense(phone, additionalDays) {
    const existing = db.licenses[phone];
    let newExpiresAt;
    const now = Date.now();
    
    if (existing && existing.expires_at && new Date(existing.expires_at).getTime() > now) {
      const expDate = new Date(existing.expires_at);
      expDate.setDate(expDate.getDate() + additionalDays);
      newExpiresAt = expDate.toISOString();
    } else {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + additionalDays);
      newExpiresAt = expDate.toISOString();
    }

    let plan_type = existing?.plan_type || 'PRO';
    if (additionalDays >= 365) plan_type = '1_YEAR';
    else if (additionalDays >= 90) plan_type = '3_MONTHS';
    else if (additionalDays >= 30) plan_type = '1_MONTH';
    else if (additionalDays === 7) plan_type = 'TRIAL';

    if (!db.licenses[phone]) {
      db.licenses[phone] = {
        phone,
        plan_type,
        status: 'ACTIVE',
        expires_at: newExpiresAt,
        machine_id: null,
        device_name: 'Personal Laptop',
        updated_at: new Date().toISOString()
      };
    } else {
      db.licenses[phone].plan_type = plan_type;
      db.licenses[phone].status = 'ACTIVE';
      db.licenses[phone].expires_at = newExpiresAt;
      db.licenses[phone].updated_at = new Date().toISOString();
    }

    if (!db.users[phone]) {
      db.users[phone] = {
        phone,
        created_at: new Date().toISOString(),
        is_blocked: false
      };
    }

    save();
    return db.licenses[phone];
  },
  revokeLicense(phone) {
    if (db.licenses[phone]) {
      db.licenses[phone].status = 'REVOKED';
      db.licenses[phone].updated_at = new Date().toISOString();
      save();
      return true;
    }
    return false;
  },
  resetDeviceLock(phone) {
    if (db.licenses[phone]) {
      db.licenses[phone].machine_id = null;
      db.licenses[phone].updated_at = new Date().toISOString();
      save();
      return true;
    }
    return false;
  },
  deleteUser(phone) {
    if (db.users && db.users[phone]) delete db.users[phone];
    if (db.licenses && db.licenses[phone]) delete db.licenses[phone];
    if (db.otps && db.otps[phone]) delete db.otps[phone];
    save();
    return true;
  },
  setUserNotes(phone, notes) {
    if (db.users && db.users[phone]) {
      db.users[phone].notes = notes;
      save();
      return true;
    }
    return false;
  },

  // Activities & Audit Log
  addActivity(action, details = {}) {
    if (!db.activities) db.activities = [];
    db.activities.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      action,
      details,
      timestamp: new Date().toISOString()
    });
    if (db.activities.length > 60) {
      db.activities = db.activities.slice(0, 60);
    }
    save();
  },
  getActivities() {
    return db.activities || [];
  },

  // OTPs
  saveOtp(phone, otp, expirySeconds = 300) {
    db.otps[phone] = {
      otp,
      expires_at: Date.now() + (expirySeconds * 1000),
      attempts: 0
    };
    save();
  },
  verifyOtp(phone, inputOtp) {
    const entry = db.otps[phone];
    if (!entry) return { valid: false, reason: 'OTP not found or expired' };

    if (Date.now() > entry.expires_at) {
      delete db.otps[phone];
      save();
      return { valid: false, reason: 'OTP has expired' };
    }

    entry.attempts = (entry.attempts || 0) + 1;
    if (entry.attempts > 5) {
      delete db.otps[phone];
      save();
      return { valid: false, reason: 'Too many invalid attempts' };
    }

    if (entry.otp.toString().trim() === inputOtp.toString().trim()) {
      delete db.otps[phone];
      save();
      return { valid: true };
    }

    save();
    return { valid: false, reason: 'Invalid OTP code' };
  }
};
