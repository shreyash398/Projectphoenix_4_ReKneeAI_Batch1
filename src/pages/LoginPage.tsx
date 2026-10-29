import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Lock,
  Mail,
  ArrowRight,
  Stethoscope,
  AlertCircle,
  ShieldCheck,
  Heart,
  Eye,
  EyeOff,
  Activity,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, authError, clearAuthError } = useAuth();

  const [activeTab, setActiveTab] = useState<'patient' | 'clinician'>('patient');
  const [email, setEmail] = useState<string>(activeTab === 'patient' ? 'patient@reknee.ai' : 'clinician@reknee.ai');
  const [password, setPassword] = useState<string>('Recovery2026!');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Read redirect destination or incoming auth message
  const locationState = location.state as { from?: { pathname?: string }; message?: string } | null;
  const redirectTarget = locationState?.from?.pathname || (activeTab === 'clinician' ? '/clinician' : '/');
  const sessionNotice = locationState?.message || authError;

  const handleTabChange = (tab: 'patient' | 'clinician') => {
    setActiveTab(tab);
    setEmail(tab === 'patient' ? 'patient@reknee.ai' : 'clinician@reknee.ai');
    setLocalError(null);
    clearAuthError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    setLocalError(null);
    clearAuthError();

    try {
      const { error } = await signIn(email, password || undefined);
      if (error) {
        setLocalError(error.message);
      } else {
        const dest = activeTab === 'clinician'
          ? (redirectTarget.startsWith('/clinician') ? redirectTarget : '/clinician')
          : (redirectTarget.startsWith('/clinician') ? '/' : redirectTarget);
        navigate(dest, { replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.';
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Ambient Decorative Blooms */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[15%] -right-[15%] w-[340px] h-[340px] rounded-full bg-secondary/8 blur-[90px]" />
        <div className="absolute top-[40%] -left-[20%] w-[320px] h-[320px] rounded-full bg-primary/8 blur-[90px]" />
      </div>

      <div className="relative z-10 max-w-sm w-full mx-auto flex flex-col items-center">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mt-2 mb-6 w-full">
          {/* Animated Heartbeat Waveform Emblem */}
          <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-soft mb-3 border border-surface-container-high/60">
            <div className="w-12 h-12 rounded-xl bg-primary-fixed/40 flex items-center justify-center text-primary">
              <Activity className="w-6 h-6 stroke-[2.3]" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-container" />
            </span>
          </div>

          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xl font-bold text-on-surface tracking-tight">ReKnee</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-container font-bold tracking-wider uppercase">
              AI
            </span>
          </div>
          <p className="text-xs text-on-surface-variant font-medium">Connected Recovery &amp; Clinical Care</p>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight mt-3">Welcome to ReKnee</h1>
          <p className="text-xs text-on-surface-variant max-w-xs mt-0.5">
            Access your personalized recovery companion or orthopedic caseload.
          </p>
        </div>

        {/* Role Selector Segmented Pill Control */}
        <div className="w-full bg-surface-container-low rounded-full p-1 flex relative shadow-inner mb-3 border border-surface-container-high/40">
          <button
            type="button"
            onClick={() => handleTabChange('patient')}
            className={`flex-1 py-2.5 px-4 rounded-full flex items-center justify-center gap-2 text-xs font-bold transition-all duration-200 ${
              activeTab === 'patient'
                ? 'bg-white text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Heart className={`w-4 h-4 ${activeTab === 'patient' ? 'text-primary fill-primary' : ''}`} />
            <span>Patient</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('clinician')}
            className={`flex-1 py-2.5 px-4 rounded-full flex items-center justify-center gap-2 text-xs font-bold transition-all duration-200 ${
              activeTab === 'clinician'
                ? 'bg-white text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Stethoscope className={`w-4 h-4 ${activeTab === 'clinician' ? 'text-primary' : ''}`} />
            <span>Clinician</span>
          </button>
        </div>

        {/* Dynamic Hint Banner */}
        <div className="w-full bg-surface-container-low rounded-2xl p-3 mb-4 flex items-start gap-2.5 border border-surface-container-high/40">
          <div className="w-5 h-5 rounded-full bg-primary-fixed/40 flex items-center justify-center shrink-0 mt-0.5 text-primary">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {activeTab === 'patient'
              ? 'Sign in with your recovery ID, mobile number, or email registered by your orthopedic surgeon.'
              : 'Sign in with your clinical credentials, hospital NPI number, or department email.'}
          </p>
        </div>

        {/* Authentication Card */}
        <div className="w-full bg-white rounded-3xl p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] border border-surface-container-high/60 space-y-4">
          {sessionNotice && (
            <div className="p-3 bg-error-container text-on-error-container rounded-2xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{sessionNotice}</span>
            </div>
          )}

          {localError && (
            <div className="p-3 bg-error-container text-on-error-container rounded-2xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{localError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Identifier Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                {activeTab === 'patient' ? 'Recovery ID or Email' : 'Clinic Email or NPI'}
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-outline pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={activeTab === 'patient' ? 'e.g. patient@reknee.ai' : 'e.g. clinician@reknee.ai'}
                  className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-sm rounded-2xl py-3 pl-10 pr-4 outline-none focus:bg-white focus:ring-2 focus:ring-primary-container transition-all"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-4 h-4 text-outline pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-sm rounded-2xl py-3 pl-10 pr-10 outline-none focus:bg-white focus:ring-2 focus:ring-primary-container transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-outline hover:text-on-surface p-1 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[52px] rounded-full bg-primary-container text-on-primary-container font-bold text-sm flex items-center justify-center gap-2 shadow-[0_8px_20px_-4px_rgba(22,168,120,0.35)] hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="animate-spin text-base">⏳</span>
              ) : (
                <>
                  <span>Sign In as {activeTab === 'patient' ? 'Patient' : 'Clinician'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Persona Switcher for Instant Testing */}
          <div className="pt-2 border-t border-surface-container-high/40">
            <span className="text-[10px] font-bold text-outline uppercase tracking-wider block mb-2 text-center">
              Quick Test Personas
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('patient');
                  setEmail('patient@reknee.ai');
                  setPassword('Recovery2026!');
                }}
                className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-left transition-colors"
              >
                <span className="text-[11px] font-bold text-on-surface block">Eleanor Vance</span>
                <span className="text-[10px] text-on-surface-variant block">Post-TKR Patient</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('clinician');
                  setEmail('clinician@reknee.ai');
                  setPassword('Recovery2026!');
                }}
                className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-left transition-colors"
              >
                <span className="text-[11px] font-bold text-on-surface block">Dr. Marcus Patel</span>
                <span className="text-[10px] text-on-surface-variant block">Attending Surgeon</span>
              </button>
            </div>
          </div>
        </div>

        {/* Trust, Compliance & Security Footnote */}
        <div className="w-full mt-6 flex flex-col items-center text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low text-on-surface-variant text-[11px] font-medium border border-surface-container-high/40">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <span>HIPAA Compliant • 256-bit Encrypted Telehealth</span>
          </div>
        </div>
      </div>
    </div>
  );
};
