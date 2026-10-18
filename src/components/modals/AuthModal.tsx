import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  Smartphone, 
  ShieldCheck, 
  ArrowRight, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Globe, 
  X,
  Laptop
} from 'lucide-react';
import { authService, LicenseInfo } from '../../services/authService';
import logoImg from '../../assets/logo.png';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (license: LicenseInfo) => void;
  canDismiss?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  canDismiss = false
}) => {
  const [step, setStep] = useState<'PHONE' | 'OTP' | 'SUCCESS'>('PHONE');
  const [phone, setPhone] = useState('91');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [activeLicense, setActiveLicense] = useState<LicenseInfo | null>(null);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(() => {
    const stored = localStorage.getItem('storyreel_license_server_url');
    if (!stored || stored.includes('localhost') || stored.includes('127.0.0.1')) {
      return 'https://studio.enrollx.in';
    }
    return stored.trim();
  });

  // Ensure stale localhost entries from previous dev runs are reset to production
  useEffect(() => {
    const stored = localStorage.getItem('storyreel_license_server_url');
    if (!stored || stored.includes('localhost') || stored.includes('127.0.0.1')) {
      localStorage.setItem('storyreel_license_server_url', 'https://studio.enrollx.in');
      setServerUrl('https://studio.enrollx.in');
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (!isOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phone || phone.length < 10) {
      setError('Please enter a valid WhatsApp phone number');
      return;
    }

    setLoading(true);
    const res = await authService.sendOtp(phone);
    setLoading(false);

    if (res.success) {
      setStep('OTP');
      setCooldown(45);
    } else {
      setError(res.error || 'Failed to send OTP');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otp || otp.length < 4) {
      setError('Please enter the 6-digit OTP code');
      return;
    }

    setLoading(true);
    const res = await authService.verifyOtp(phone, otp);
    setLoading(false);

    if (res.success && res.license) {
      setActiveLicense(res.license);
      setStep('SUCCESS');
      setTimeout(() => {
        onAuthSuccess(res.license!);
        onClose();
      }, 1800);
    } else {
      setError(res.error || 'Invalid OTP code');
    }
  };

  const handleSaveServerUrl = () => {
    authService.setServerUrl(serverUrl);
    setShowServerConfig(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-studio-900 border border-studio-700/80 rounded-2xl shadow-2xl shadow-indigo-950/40 overflow-hidden">
        {/* Top Gradient Banner */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        {canDismiss && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-studio-400 hover:text-white rounded-lg hover:bg-studio-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-3.5">
              <img src={logoImg} alt="Story Studio" className="w-10 h-10 object-contain" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {step === 'SUCCESS' ? 'License Activated!' : 'Activate Story Studio'}
            </h2>
            <p className="text-xs text-studio-400 mt-1 max-w-xs">
              {step === 'SUCCESS'
                ? 'Your device is verified and your studio is ready.'
                : 'Sign in with your WhatsApp number to verify your access license.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Phone Input */}
          {step === 'PHONE' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-studio-400 mb-1.5">
                  WhatsApp Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-studio-400">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="e.g. 919876543210"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-studio-950/80 border border-studio-700/80 rounded-xl text-sm text-white placeholder-studio-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                  />
                </div>
                <p className="text-[11px] text-studio-500 mt-1.5">
                  Include country code (e.g. <span className="text-indigo-400 font-mono">91</span> for India). We will send an instant WhatsApp OTP.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sending OTP on WhatsApp...
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: OTP Input */}
          {step === 'OTP' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-studio-400">
                    Enter 6-Digit WhatsApp OTP
                  </label>
                  <button
                    type="button"
                    onClick={() => { setStep('PHONE'); setError(null); }}
                    className="text-[11px] text-indigo-400 hover:underline"
                  >
                    Change Number
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-studio-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="••••••"
                    autoFocus
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-studio-950/80 border border-studio-700/80 rounded-xl text-center text-lg tracking-[0.4em] font-mono text-white placeholder-studio-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-studio-500">
                    Sent to: <span className="text-white font-mono">+{phone}</span>
                  </span>
                  {cooldown > 0 ? (
                    <span className="text-[11px] text-studio-500">
                      Resend in {cooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Resend OTP
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Validating Device License...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify & Unlock Studio</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 3: Success Screen */}
          {step === 'SUCCESS' && activeLicense && (
            <div className="text-center py-4 space-y-3 animate-fadeIn">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  {activeLicense.plan_type} PLAN
                </div>
                <p className="text-sm font-semibold text-white mt-1">
                  {activeLicense.plan_type === 'LIFETIME'
                    ? '💎 Lifetime License Active'
                    : `⏳ ${activeLicense.days_left} Days Remaining`}
                </p>
                <p className="text-xs text-studio-400 mt-1 flex items-center justify-center gap-1">
                  <Laptop className="w-3.5 h-3.5 text-studio-500" /> Bound to this laptop
                </p>
              </div>
            </div>
          )}

          {/* Footer: Server Config Toggle */}
          <div className="mt-6 pt-4 border-t border-studio-800/80 flex items-center justify-between text-xs text-studio-500">
            <button
              type="button"
              onClick={() => setShowServerConfig(!showServerConfig)}
              className="flex items-center gap-1 text-[11px] text-studio-500 hover:text-studio-300 transition-colors"
            >
              <Globe className="w-3 h-3" />
              <span>{showServerConfig ? 'Hide Server URL' : 'License Server Settings'}</span>
            </button>
            <span className="text-[10px] text-studio-600">Story Studio Anti-Piracy v1.0</span>
          </div>

          {showServerConfig && (
            <div className="mt-3 p-3 bg-studio-950/90 rounded-xl border border-studio-800 space-y-2 text-xs animate-fadeIn">
              <label className="text-[11px] text-studio-400 font-semibold block">
                Hostinger / Custom License API URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://api.yourdomain.com"
                  className="flex-1 px-2.5 py-1.5 bg-studio-900 border border-studio-700 rounded-lg text-xs text-white"
                />
                <button
                  type="button"
                  onClick={handleSaveServerUrl}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-xs"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
