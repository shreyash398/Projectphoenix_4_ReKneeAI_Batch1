import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { Button } from '../components/common/Button';
import { useAuth } from '../contexts/AuthContext';

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useAuth();

  return (
    <div className="min-h-screen bg-warm-bg flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-warm-border shadow-card p-6 sm:p-8 max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-status-warning-bg text-status-warning mx-auto flex items-center justify-center shadow-soft">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div>
          <h1 className="text-lg font-bold text-navy-900">403 — Restricted Area</h1>
          <p className="text-xs text-slate-muted mt-1 leading-relaxed">
            You do not have permission to view this section with your current{' '}
            <strong className="text-navy-900 font-semibold">{role}</strong> role. Clinician routes require clinical provider authorization.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Go Back
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(role === 'clinician' ? '/clinician' : '/')}
            icon={<Home className="w-3.5 h-3.5" />}
          >
            Go to {role === 'clinician' ? 'Clinician Dashboard' : 'Patient Home'}
          </Button>
        </div>
      </div>
    </div>
  );
};
