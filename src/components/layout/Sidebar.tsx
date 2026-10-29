import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  Activity,
  ClipboardCheck,
  MessageSquareHeart,
  TrendingUp,
  Users,
  BellRing,
  LayoutDashboard,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types/database';

interface SidebarProps {
  role: UserRole;
  alertCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ role, alertCount = 0 }) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  interface NavItem {
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    end?: boolean;
    badge?: number;
  }

  const patientNavItems: NavItem[] = [
    { label: 'Home', path: '/', icon: Home, end: true },
    { label: 'Exercise', path: '/exercise', icon: Activity },
    { label: 'Check-in', path: '/check-in', icon: ClipboardCheck },
    { label: 'Assistant', path: '/assistant', icon: MessageSquareHeart },
    { label: 'Progress', path: '/progress', icon: TrendingUp },
  ];

  const clinicianNavItems: NavItem[] = [
    { label: 'Overview', path: '/clinician', icon: LayoutDashboard, end: true },
    { label: 'Patients', path: '/clinician/patients', icon: Users },
    {
      label: 'Alerts',
      path: '/clinician/alerts',
      icon: BellRing,
      badge: alertCount > 0 ? alertCount : undefined,
    },
    { label: 'Verifications', path: '/clinician/verifications', icon: ShieldCheck },
  ];

  const navItems = role === 'clinician' ? clinicianNavItems : patientNavItems;

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col h-screen fixed left-0 top-0 bottom-0 z-30 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-surface-container-high/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-container text-white flex items-center justify-center shadow-sm">
            <Activity className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-on-surface text-base tracking-tight">ReKnee AI</span>
            </div>
            <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">Clinical Recovery</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-full text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-error text-white rounded-full">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* User Persona & Role Controls Footer */}
      <div className="p-4 border-t border-surface-container-high/60 bg-surface-container-lowest/50 space-y-3">
        {/* Profile Card */}
        {profile && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-on-surface text-surface flex items-center justify-center text-xs font-bold shrink-0">
                {profile.full_name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-on-surface truncate">
                  {profile.full_name.split(' (')[0]}
                </p>
                <p className="text-[11px] text-on-surface-variant capitalize flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {role === 'clinician' ? 'Clinician' : 'Patient'}
                </p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-full transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
