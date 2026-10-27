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
  Shield,
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
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-calm to-teal-accent text-white flex items-center justify-center shadow-soft">
            <Shield className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-navy-900 text-base tracking-tight">ReKnee AI</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-teal-light text-teal-hover font-semibold shadow-soft border border-teal-border/60'
                    : 'text-slate-600 hover:text-navy-900 hover:bg-slate-50'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-status-error text-white rounded-full">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* User Persona & Role Controls Footer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
        {/* Profile Card */}
        {profile && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-navy-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {profile.full_name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-navy-900 truncate">
                  {profile.full_name.split(' (')[0]}
                </p>
                <p className="text-[10px] text-slate-500 capitalize flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {role === 'clinician' ? 'Clinician' : 'Patient'}
                </p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="p-1.5 text-slate-400 hover:text-navy-900 hover:bg-slate-200/60 rounded-lg transition-colors"
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
