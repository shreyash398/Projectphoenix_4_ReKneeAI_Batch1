import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, UserCheck, Stethoscope, AlertCircle, Info } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase/client';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, authError, clearAuthError, switchDemoRole } = useAuth();

  const [activeTab, setActiveTab] = useState<'patient' | 'clinician'>('patient');
  const [email, setEmail] = useState<string>(activeTab === 'patient' ? 'patient@demo.reknee.ai' : 'clinician@demo.reknee.ai');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Read redirect destination or incoming auth message
  const locationState = location.state as { from?: { pathname?: string }; message?: string } | null;
  const redirectTarget = locationState?.from?.pathname || (activeTab === 'clinician' ? '/clinician' : '/');
  const sessionNotice = locationState?.message || authError;

  const handleTabChange = (tab: 'patient' | 'clinician') => {
    setActiveTab(tab);
    setEmail(tab === 'patient' ? 'patient@demo.reknee.ai' : 'clinician@demo.reknee.ai');
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
        const dest = activeTab === 'clinician' ? (redirectTarget.startsWith('/clinician') ? redirectTarget : '/clinician') : (redirectTarget.startsWith('/clinician') ? '/' : redirectTarget);
        navigate(dest, { replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.';
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoQuickSignIn = (role: 'patient' | 'clinician') => {
    switchDemoRole(role);
    navigate(role === 'clinician' ? '/clinician' : '/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-warm-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-calm to-teal-accent text-white mx-auto flex items-center justify-center shadow-soft">
            <Shield className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">ReKnee AI</h1>
              <Badge variant="warning" size="sm">
                Prototype / Demo
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Connected Post-Operative Knee Rehabilitation Command Center
            </p>
            <p className="text-[10px] text-amber-700 mt-1 font-semibold uppercase tracking-wider">
              Synthetic data only · not clinically validated
            </p>
          </div>
        </div>

        {/* Authentication Card */}
        <Card className="p-6 border-slate-200/80 shadow-card">
          {/* Portal Selector Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-5 border border-slate-200/60">
            <button
              type="button"
              onClick={() => handleTabChange('patient')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'patient'
                  ? 'bg-white text-navy-900 shadow-soft'
                  : 'text-slate-500 hover:text-navy-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-teal-calm" />
              <span>Patient Portal</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('clinician')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'clinician'
                  ? 'bg-white text-navy-900 shadow-soft'
                  : 'text-slate-500 hover:text-navy-900'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5 text-teal-calm" />
              <span>Clinician Portal</span>
            </button>
          </div>

          {/* Session / Expired Notice */}
          {sessionNotice && !localError && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Authentication Notice</span>
                <p className="text-[11px] text-amber-800">{sessionNotice}</p>
              </div>
            </div>
          )}

          {/* Error Notice */}
          {localError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-status-error flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-status-error shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Sign-in Failed</span>
                <p className="text-[11px] text-rose-700">{localError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block mb-1">
                {activeTab === 'patient' ? 'Patient Email Address' : 'Clinician Provider Email'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-subtle absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={activeTab === 'patient' ? 'patient@demo.reknee.ai' : 'clinician@demo.reknee.ai'}
                  required
                  className="w-full text-xs pl-9 pr-3 py-2.5 rounded-lg border border-warm-border focus:border-teal-calm bg-warm-bg/30 text-navy-900"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block mb-1">
                Password {isSupabaseConfigured ? '' : '(Optional in Demo Mode)'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-subtle absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs pl-9 pr-3 py-2.5 rounded-lg border border-warm-border focus:border-teal-calm bg-warm-bg/30 text-navy-900"
                />
              </div>
              <p className="text-[10px] text-slate-subtle mt-1">
                {isSupabaseConfigured
                  ? 'Authenticated via encrypted Supabase Auth'
                  : 'Running in demonstration sandbox. Any password or empty password accepted.'}
              </p>
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={isSubmitting}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In as {activeTab === 'patient' ? 'Patient' : 'Clinician'}
            </Button>
          </form>

          {/* Quick Demonstration Persona Shortcuts */}
          <div className="mt-5 pt-4 border-t border-warm-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-subtle uppercase tracking-wider">
                Quick Demonstration Access
              </span>
              <span className="text-[10px] text-teal-calm font-medium">Evaluation Mode</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoQuickSignIn('patient')}
                className="flex flex-col items-start p-2.5 rounded-xl border border-warm-border bg-warm-bg/50 hover:bg-white hover:border-teal-calm transition-all text-left"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-teal-calm" />
                  <span className="text-xs font-bold text-navy-900">Eleanor Vance</span>
                </div>
                <span className="text-[10px] text-slate-muted">Patient (TKA Day 14)</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoQuickSignIn('clinician')}
                className="flex flex-col items-start p-2.5 rounded-xl border border-warm-border bg-warm-bg/50 hover:bg-white hover:border-teal-calm transition-all text-left"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Stethoscope className="w-3.5 h-3.5 text-teal-calm" />
                  <span className="text-xs font-bold text-navy-900">Dr. Marcus Patel</span>
                </div>
                <span className="text-[10px] text-slate-muted">DPT Physical Therapist</span>
              </button>
            </div>
          </div>
        </Card>

        {/* Security & HIPAA Notice */}
        <div className="p-3 bg-warm-subtle/80 rounded-xl border border-warm-border flex items-start gap-2.5 text-[11px] text-slate-muted leading-relaxed">
          <Info className="w-4 h-4 text-teal-calm shrink-0 mt-0.5" />
          <p>
            <strong className="text-navy-900 font-semibold">Protected Healthcare Platform:</strong> Patient data access is strictly governed by Row Level Security (RLS) policies. Clinicians may only access authorized patients with active care-team relationships.
          </p>
        </div>
      </div>
    </div>
  );
};
