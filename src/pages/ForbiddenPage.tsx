import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home, LogIn } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../contexts/AuthContext';

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, signOut } = useAuth();

  const state = location.state as { requiredRole?: string; userRole?: string } | null;
  const requiredRole = state?.requiredRole || (role === 'patient' ? 'clinician' : 'patient');

  const handleSwitchAccount = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-warm-bg flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-warm-border shadow-card p-6 sm:p-8 max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-status-warning-bg text-status-warning mx-auto flex items-center justify-center shadow-soft">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <h1 className="text-lg font-bold text-navy-900">403 — Restricted Area</h1>
            <Badge variant="warning" size="sm">
              Unauthorized
            </Badge>
          </div>
          <p className="text-xs text-slate-muted leading-relaxed">
            You do not have permission to view this section with your current{' '}
            <strong className="text-navy-900 font-semibold">{role || 'unassigned'}</strong> role.
            This area requires an authorized{' '}
            <strong className="text-navy-900 font-semibold">{requiredRole}</strong> account.
          </p>
        </div>

        <div className="p-3 bg-warm-subtle rounded-xl border border-warm-border text-left text-xs text-slate-muted">
          <span className="font-semibold text-navy-900 block mb-0.5">Clinical Authorization Notice:</span>
          Under healthcare access controls, clinician oversight routes are strictly isolated from patient views, and patient exercise logging is restricted to verified recovery plan holders.
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Button
            fullWidth
            variant="primary"
            onClick={() => navigate(role === 'clinician' ? '/clinician' : '/')}
            icon={<Home className="w-4 h-4" />}
          >
            Go to {role === 'clinician' ? 'Clinician Dashboard' : 'Patient Home'}
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => navigate(-1)}
              icon={<ArrowLeft className="w-3.5 h-3.5" />}
            >
              Go Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleSwitchAccount}
              icon={<LogIn className="w-3.5 h-3.5" />}
            >
              Switch Account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
