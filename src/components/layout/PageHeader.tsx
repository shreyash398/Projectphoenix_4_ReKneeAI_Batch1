import React from 'react';
import { Shield, UserCheck, Stethoscope } from 'lucide-react';
import { repository } from '../../lib/supabase/repository';
import { Profile } from '../../types/database';

interface PageHeaderProps {
  currentProfile: Profile;
  onRoleSwitch: (newProfile: Profile) => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ currentProfile, onRoleSwitch }) => {
  const toggleRole = () => {
    const nextRole = currentProfile.role === 'patient' ? 'clinician' : 'patient';
    const updated = repository.switchUserRole(nextRole);
    onRoleSwitch(updated);
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
              <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-warm-subtle text-slate-muted border border-warm-border">
                Companion
              </span>
            </div>
            <p className="text-[11px] text-slate-muted hidden sm:block">Connected Post-Op Recovery</p>
          </div>
        </div>

        {/* Demo Role Switcher for Hackathon Judges */}
        <div className="flex items-center gap-2">
          <div className="text-right hidden xs:block">
            <p className="text-xs font-semibold text-navy-900 truncate max-w-[150px]">
              {currentProfile.full_name.split(' (')[0]}
            </p>
            <p className="text-[10px] text-slate-subtle capitalize">
              Role: <span className="font-medium text-teal-calm">{currentProfile.role}</span>
            </p>
          </div>

          <button
            onClick={toggleRole}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-warm-subtle text-navy-900 border border-warm-border hover:bg-white hover:border-teal-calm transition-colors shadow-soft"
            title="Switch demo persona for testing"
          >
            {currentProfile.role === 'patient' ? (
              <>
                <Stethoscope className="w-3.5 h-3.5 text-teal-calm" />
                <span>Switch to Clinician</span>
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5 text-teal-calm" />
                <span>Switch to Patient</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
