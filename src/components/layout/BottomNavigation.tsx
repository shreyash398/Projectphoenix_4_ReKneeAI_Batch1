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
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1 shadow-card pb-[env(safe-area-inset-bottom,4px)]">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <NavLink
            to="/clinician"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 px-3 rounded-xl text-[11px] font-medium transition-all ${
                isActive ? 'text-teal-hover font-semibold bg-teal-light' : 'text-slate-500 hover:text-navy-900'
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span>Overview</span>
          </NavLink>

          <NavLink
            to="/clinician/patients"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 px-3 rounded-xl text-[11px] font-medium transition-all ${
                isActive ? 'text-teal-hover font-semibold bg-teal-light' : 'text-slate-500 hover:text-navy-900'
              }`
            }
          >
            <Users className="w-5 h-5 mb-0.5" />
            <span>Patients</span>
          </NavLink>

          <NavLink
            to="/clinician/alerts"
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 px-3 rounded-xl text-[11px] font-medium transition-all ${
                isActive ? 'text-teal-hover font-semibold bg-teal-light' : 'text-slate-500 hover:text-navy-900'
              }`
            }
          >
            <BellRing className="w-5 h-5 mb-0.5" />
            <span>Alerts</span>
            {alertCount > 0 && (
              <span className="absolute top-0.5 right-2 w-4 h-4 bg-status-error text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {alertCount}
              </span>
            )}
          </NavLink>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-1 py-1 shadow-card pb-[env(safe-area-inset-bottom,4px)]">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 px-2.5 rounded-xl text-[10px] font-medium transition-all ${
              isActive ? 'text-teal-hover font-semibold bg-teal-light' : 'text-slate-500 hover:text-navy-900'
            }`
          }
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </NavLink>

        <NavLink
          to="/exercise"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 px-2.5 rounded-xl text-[10px] font-medium transition-all ${
              isActive ? 'text-teal-hover font-semibold bg-teal-light' : 'text-slate-500 hover:text-navy-900'
            }`
          }
        >
          <Activity className="w-5 h-5 mb-0.5" />
          <span>Exercise</span>
        </NavLink>

        <NavLink
          to="/check-in"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 px-2.5 rounded-xl text-[10px] font-medium transition-all ${
              isActive ? 'text-teal-hover font-semibold bg-teal-light' : 'text-slate-500 hover:text-navy-900'
            }`
          }
        >
          <ClipboardCheck className="w-5 h-5 mb-0.5" />
          <span>Check-in</span>
        </NavLink>

        <NavLink
          to="/assistant"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 px-2.5 rounded-xl text-[10px] font-medium transition-all ${
              isActive ? 'text-teal-hover font-semibold bg-teal-light' : 'text-slate-500 hover:text-navy-900'
            }`
          }
        >
          <MessageSquareHeart className="w-5 h-5 mb-0.5" />
          <span>Assistant</span>
        </NavLink>

        <NavLink
          to="/progress"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 px-2.5 rounded-xl text-[10px] font-medium transition-all ${
              isActive ? 'text-teal-hover font-semibold bg-teal-light' : 'text-slate-500 hover:text-navy-900'
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
