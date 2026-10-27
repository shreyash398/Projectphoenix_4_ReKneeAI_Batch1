import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const PageHeader: React.FC = () => {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-warm-border px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-calm text-white flex items-center justify-center shadow-soft">
            <Shield className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-navy-900 text-sm tracking-tight">ReKnee AI</span>
            </div>
          </div>
        </div>

        {/* User Persona & Role Controls */}
        <div className="flex items-center gap-2">
          {profile && (
            <div className="text-right hidden xs:block">
              <p className="text-xs font-semibold text-navy-900 truncate max-w-[150px]">
                {profile.full_name.split(' (')[0]}
              </p>
              <p className="text-[10px] text-slate-subtle capitalize">
                Portal: <span className="font-medium text-teal-calm">{role === 'clinician' ? 'Clinician' : 'Patient'}</span>
              </p>
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="p-1.5 text-slate-muted hover:text-navy-900 hover:bg-warm-subtle rounded-lg border border-warm-border transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
