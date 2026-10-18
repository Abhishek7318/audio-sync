import { electronBridge } from './electronBridge';

export interface LicenseInfo {
  phone: string;
  plan_type: 'TRIAL' | '1_MONTH' | '3_MONTHS' | '1_YEAR' | 'LIFETIME' | string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'BLOCKED' | string;
  expires_at: string | null;
  days_left: number | 'LIFETIME';
  device_name?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  phone: string | null;
  license: LicenseInfo | null;
  loading: boolean;
  error: string | null;
}

// Default production license server URL (Hostinger)
const DEFAULT_SERVER_URL = 'https://studio.enrollx.in';

class AuthService {
  private getServerUrl(): string {
    const stored = localStorage.getItem('storyreel_license_server_url');
    if (!stored || stored.includes('localhost') || stored.includes('127.0.0.1')) {
      return DEFAULT_SERVER_URL;
    }
    return stored.trim().replace(/\/+$/, '');
  }

  public setServerUrl(url: string) {
    localStorage.setItem('storyreel_license_server_url', url.trim());
  }

  public async initSession(): Promise<void> {
    try {
      // 1. Try reading persistent session from disk
      const diskSession = await electronBridge.getAuthSession();
      if (diskSession) {
        if (diskSession.token && !localStorage.getItem('storyreel_auth_token')) {
          localStorage.setItem('storyreel_auth_token', diskSession.token);
        }
        if (diskSession.phone && !localStorage.getItem('storyreel_user_phone')) {
          localStorage.setItem('storyreel_user_phone', diskSession.phone);
        }
        if (diskSession.license && !localStorage.getItem('storyreel_license_info')) {
          localStorage.setItem('storyreel_license_info', JSON.stringify(diskSession.license));
        }
      } else {
        // If disk session was empty but localStorage has session, sync to disk
        const token = localStorage.getItem('storyreel_auth_token');
        const phone = localStorage.getItem('storyreel_user_phone');
        const license = this.getStoredLicense();
        if (token && phone && license) {
          await electronBridge.saveAuthSession({ token, phone, license });
        }
      }
    } catch (e) {
      console.warn('Session init warning:', e);
    }
  }

  public hasSession(): boolean {
    const token = this.getStoredToken();
    const phone = localStorage.getItem('storyreel_user_phone');
    const license = this.getStoredLicense();
    return !!(token || phone || license);
  }

  public isSessionActive(): boolean {
    const license = this.getStoredLicense();
    if (!license) return false;
    if (license.status !== 'ACTIVE') return false;
    if (license.plan_type === 'LIFETIME') return true;
    if (license.expires_at) {
      return new Date(license.expires_at).getTime() > Date.now();
    }
    return true;
  }

  public getStoredToken(): string | null {
    return localStorage.getItem('storyreel_auth_token');
  }

  public getStoredLicense(): LicenseInfo | null {
    const raw = localStorage.getItem('storyreel_license_info');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public async sendOtp(phone: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const serverUrl = this.getServerUrl();
    try {
      const res = await fetch(`${serverUrl}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to send OTP' };
      }
      return { success: true, message: data.message };
    } catch (err: any) {
      console.error(`Failed to reach ${serverUrl}:`, err);
      return { success: false, error: `Connection failed (${serverUrl}): ${err.message || 'Cannot reach license server'}` };
    }
  }

  public async verifyOtp(phone: string, otp: string): Promise<{ success: boolean; license?: LicenseInfo; error?: string }> {
    try {
      const serverUrl = this.getServerUrl();
      const machineId = await electronBridge.getMachineId();
      const deviceName = await electronBridge.getDeviceName();

      const res = await fetch(`${serverUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          otp,
          machineId,
          deviceName
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'OTP verification failed' };
      }

      const verifiedLicense: LicenseInfo = {
        phone: data.user.phone,
        ...data.license
      };

      // Store credentials in localStorage
      localStorage.setItem('storyreel_auth_token', data.token);
      localStorage.setItem('storyreel_user_phone', data.user.phone);
      localStorage.setItem('storyreel_license_info', JSON.stringify(verifiedLicense));

      // Also persist to Electron user data disk
      await electronBridge.saveAuthSession({
        token: data.token,
        phone: data.user.phone,
        license: verifiedLicense
      });

      return {
        success: true,
        license: verifiedLicense
      };
    } catch (err: any) {
      return { success: false, error: `Verification error: ${err.message || 'Server offline'}` };
    }
  }

  public async checkLicense(): Promise<{ valid: boolean; license: LicenseInfo | null; error?: string }> {
    await this.initSession();
    const token = this.getStoredToken();
    const phone = localStorage.getItem('storyreel_user_phone');
    const cached = this.getStoredLicense();

    if (!token && !phone && !cached) {
      return { valid: false, license: null, error: 'No active session' };
    }

    try {
      const serverUrl = this.getServerUrl();
      const machineId = await electronBridge.getMachineId();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${serverUrl}/api/license/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          phone,
          machineId
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok || !data.success) {
        // If license explicitly revoked, expired, or blocked
        if (data.status === 'EXPIRED' || data.status === 'REVOKED' || data.status === 'BLOCKED') {
          if (cached) {
            cached.status = data.status;
            localStorage.setItem('storyreel_license_info', JSON.stringify(cached));
            await electronBridge.saveAuthSession({ token: token || '', phone: phone || '', license: cached });
          }
          return { valid: false, license: data.license || cached, error: data.error };
        }

        // If hardware mismatch or temporary check issue, but we have a valid unexpired local session, keep logged in
        if (cached && (cached.plan_type === 'LIFETIME' || (cached.expires_at && new Date(cached.expires_at).getTime() > Date.now()))) {
          console.warn('Server license check non-fatal error, maintaining active session:', data.error);
          return { valid: true, license: cached };
        }

        return { valid: false, license: data.license || cached, error: data.error };
      }

      const updatedLicense: LicenseInfo = {
        phone: data.license.phone,
        plan_type: data.license.plan_type,
        status: data.license.status,
        expires_at: data.license.expires_at,
        days_left: data.license.days_left,
        device_name: data.license.device_name
      };

      localStorage.setItem('storyreel_license_info', JSON.stringify(updatedLicense));
      await electronBridge.saveAuthSession({ token: token || '', phone: phone || '', license: updatedLicense });
      return { valid: data.valid, license: updatedLicense };
    } catch (err: any) {
      // Offline fallback: if network temporarily drops, check cached expiration
      if (cached) {
        if (cached.plan_type === 'LIFETIME') {
          return { valid: true, license: cached };
        }
        if (cached.expires_at && new Date(cached.expires_at).getTime() > Date.now()) {
          return { valid: true, license: cached };
        }
      }
      return { valid: false, license: cached, error: 'License verification server unreachable' };
    }
  }

  public async logout() {
    localStorage.removeItem('storyreel_auth_token');
    localStorage.removeItem('storyreel_user_phone');
    localStorage.removeItem('storyreel_license_info');
    await electronBridge.clearAuthSession();
  }
}

export const authService = new AuthService();
