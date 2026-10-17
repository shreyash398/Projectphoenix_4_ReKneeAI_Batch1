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
} from 'lucide-react';
import { UserRole } from '../../types/database';

interface BottomNavigationProps {
  role: UserRole;
  alertCount?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ role, alertCount = 0 }) => {
  if (role === 'clinician') {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-warm-border px-2 py-1.5 shadow-card">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <NavLink
            to="/clinician"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-4 rounded-xl text-[11px] font-medium transition-all ${
                isActive ? 'text-teal-calm font-semibold' : 'text-slate-muted hover:text-navy-900'
              }`
            }
          >
            <Users className="w-5 h-5 mb-0.5" />
            <span>Patients</span>
          </NavLink>

          <NavLink
            to="/clinician/alerts"
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center py-1 px-4 rounded-xl text-[11px] font-medium transition-all ${
                isActive ? 'text-teal-calm font-semibold' : 'text-slate-muted hover:text-navy-900'
              }`
            }
          >
            <BellRing className="w-5 h-5 mb-0.5" />
            <span>Review Alerts</span>
            {alertCount > 0 && (
              <span className="absolute top-0.5 right-3 w-4 h-4 bg-status-error text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {alertCount}
              </span>
            )}
          </NavLink>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-warm-border px-1 py-1.5 shadow-card">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-medium transition-all ${
              isActive ? 'text-teal-calm font-semibold' : 'text-slate-muted hover:text-navy-900'
            }`
          }
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </NavLink>

        <NavLink
          to="/exercise"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-medium transition-all ${
              isActive ? 'text-teal-calm font-semibold' : 'text-slate-muted hover:text-navy-900'
            }`
          }
        >
          <Activity className="w-5 h-5 mb-0.5" />
          <span>Exercise</span>
        </NavLink>

        <NavLink
          to="/check-in"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-medium transition-all ${
              isActive ? 'text-teal-calm font-semibold' : 'text-slate-muted hover:text-navy-900'
            }`
          }
        >
          <ClipboardCheck className="w-5 h-5 mb-0.5" />
          <span>Check-in</span>
        </NavLink>

        <NavLink
          to="/assistant"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-medium transition-all ${
              isActive ? 'text-teal-calm font-semibold' : 'text-slate-muted hover:text-navy-900'
            }`
          }
        >
          <MessageSquareHeart className="w-5 h-5 mb-0.5" />
          <span>Assistant</span>
        </NavLink>

        <NavLink
          to="/progress"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-medium transition-all ${
              isActive ? 'text-teal-calm font-semibold' : 'text-slate-muted hover:text-navy-900'
            }`
          }
        >
          <TrendingUp className="w-5 h-5 mb-0.5" />
          <span>Progress</span>
        </NavLink>
      </div>
    </nav>
  );
};
