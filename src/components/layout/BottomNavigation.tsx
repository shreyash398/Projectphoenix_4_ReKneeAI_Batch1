import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Activity,
  ClipboardCheck,
  MessageSquareHeart,
  TrendingUp,
  Users,
  BellRing,
  LayoutDashboard,
} from 'lucide-react';
import { UserRole } from '../../types/database';

interface BottomNavigationProps {
  role: UserRole;
  alertCount?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ role, alertCount = 0 }) => {
  if (role === 'clinician') {
    return (
      <nav className="fixed bottom-0 inset-x-0 z-50 pointer-events-none pb-[env(safe-area-inset-bottom,16px)]">
        <div className="px-4 pb-4 pt-1">
          <div className="h-[64px] mx-auto max-w-md pointer-events-auto bg-white/85 backdrop-blur-xl rounded-full shadow-[0_16px_40px_-6px_rgba(17,24,39,0.14)] border border-white/60 p-1.5 flex items-center justify-between">
            <NavLink
              to="/clinician"
              end
              className={({ isActive }) =>
                `flex-1 h-full rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] transition-all ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`
              }
            >
              <LayoutDashboard className="w-5 h-5" />
              <span>Overview</span>
            </NavLink>

            <NavLink
              to="/clinician/patients"
              className={({ isActive }) =>
                `flex-1 h-full rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] transition-all ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`
              }
            >
              <Users className="w-5 h-5" />
              <span>Patients</span>
            </NavLink>

            <NavLink
              to="/clinician/alerts"
              className={({ isActive }) =>
                `relative flex-1 h-full rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] transition-all ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`
              }
            >
              <BellRing className="w-5 h-5" />
              <span>Alerts</span>
              {alertCount > 0 && (
                <span className="absolute top-1 right-4 w-4 h-4 bg-error text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm">
                  {alertCount}
                </span>
              )}
            </NavLink>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 pointer-events-none pb-[env(safe-area-inset-bottom,16px)]">
      <div className="px-3 pb-4 pt-1">
        <div className="h-[64px] mx-auto max-w-md pointer-events-auto bg-white/85 backdrop-blur-xl rounded-full shadow-[0_16px_40px_-6px_rgba(17,24,39,0.14)] border border-white/60 p-1.5 flex items-center justify-between gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex-1 h-full rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] transition-all ${
                isActive
                  ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            <Home className="w-[19px] h-[19px]" />
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/exercise"
            className={({ isActive }) =>
              `flex-1 h-full rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] transition-all ${
                isActive
                  ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            <Activity className="w-[19px] h-[19px]" />
            <span>Exercise</span>
          </NavLink>

          <NavLink
            to="/check-in"
            className={({ isActive }) =>
              `flex-1 h-full rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] transition-all ${
                isActive
                  ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            <ClipboardCheck className="w-[19px] h-[19px]" />
            <span>Check-in</span>
          </NavLink>

          <NavLink
            to="/assistant"
            className={({ isActive }) =>
              `flex-1 h-full rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] transition-all ${
                isActive
                  ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            <MessageSquareHeart className="w-[19px] h-[19px]" />
            <span>Assistant</span>
          </NavLink>

          <NavLink
            to="/progress"
            className={({ isActive }) =>
              `flex-1 h-full rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] transition-all ${
                isActive
                  ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            <TrendingUp className="w-[19px] h-[19px]" />
            <span>Progress</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
};
