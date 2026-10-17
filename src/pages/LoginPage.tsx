import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, UserCheck, Stethoscope } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase/client';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, switchDemoRole } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await signIn(email, password || undefined);
      if (error) {
        setErrorMessage(error.message);
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSignIn = (role: 'patient' | 'clinician') => {
    switchDemoRole(role);
    navigate(role === 'clinician' ? '/clinician' : '/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-warm-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-5">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-teal-calm text-white mx-auto flex items-center justify-center shadow-soft">
            <Shield className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h1 className="text-xl font-bold text-navy-900">Sign in to ReKnee AI</h1>
          <p className="text-xs text-slate-muted">
            The Connected Post-Operative Knee Rehabilitation Companion
          </p>
        </div>

        {/* Authentication Card */}
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="p-3 bg-status-error-bg text-status-error border border-red-200 rounded-lg text-xs">
                {errorMessage}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-subtle absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
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
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={isLoading}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In
            </Button>
          </form>

          {/* Demo Login Quick Shortcuts for Evaluators */}
          <div className="mt-5 pt-4 border-t border-warm-border space-y-2">
            <p className="text-[11px] font-semibold text-slate-subtle text-center uppercase tracking-wider">
              Quick Demonstration Personas
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoSignIn('patient')}
                className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-warm-border bg-warm-bg hover:bg-white text-xs font-semibold text-navy-900 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5 text-teal-calm" />
                <span>Patient Demo</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoSignIn('clinician')}
                className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-warm-border bg-warm-bg hover:bg-white text-xs font-semibold text-navy-900 transition-colors"
              >
                <Stethoscope className="w-3.5 h-3.5 text-teal-calm" />
                <span>Clinician Demo</span>
              </button>
            </div>
          </div>
        </Card>

        {/* Security Notice */}
        <p className="text-[11px] text-center text-slate-muted">
          Protected by Supabase Row Level Security (RLS). Patient records are strictly isolated.
        </p>
      </div>
    </div>
  );
};
