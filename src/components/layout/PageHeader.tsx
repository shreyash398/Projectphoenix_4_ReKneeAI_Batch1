import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Activity, LogOut, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const PageHeader: React.FC = () => {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/' || path === '/patient') return 'Home';
    if (path.startsWith('/exercise')) return 'Exercise';
    if (path.startsWith('/check-in')) return 'Check In';
    if (path.startsWith('/progress')) return 'Progress';
    if (path.startsWith('/assistant')) return 'Assistant';
    if (path.startsWith('/reports')) return 'Reports';
    if (path === '/clinician' || path === '/clinician/overview') return 'Overview';
    if (path.startsWith('/clinician/patients')) return 'Patients';
    if (path.startsWith('/clinician/alerts')) return 'Alerts';
    if (path.startsWith('/clinician/verifications')) return 'Verifications';
    return 'ReKnee';
  };

  return (
    <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-surface-container-high/60 shadow-[0_1px_12px_rgba(0,0,0,0.03)] px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Brand & Dynamic Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-container text-white flex items-center justify-center shadow-sm">
            <Activity className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider leading-none">ReKnee AI</span>
            <span className="text-[17px] font-bold text-on-surface leading-tight mt-0.5">{getPageTitle()}</span>
          </div>
        </div>

        {/* User Persona & Role Controls */}
        <div className="flex items-center gap-2">
          {profile && (
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-on-surface truncate max-w-[150px]">
                {profile.full_name.split(' (')[0]}
              </p>
              <p className="text-[11px] text-on-surface-variant font-medium">
                {role === 'clinician' ? 'Clinician' : 'Patient'}
              </p>
            </div>
          )}

          <button
            onClick={() => role === 'clinician' ? navigate('/clinician/alerts') : navigate('/')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          <button
            onClick={handleSignOut}
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
