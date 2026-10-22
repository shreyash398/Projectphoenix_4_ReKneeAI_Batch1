import React from 'react';
import { FlaskConical, RotateCcw } from 'lucide-react';
import { resetDemoStore } from '../../lib/supabase/mockStore';

interface DemoBannerProps {
  /** Optional callback after reset completes */
  onReset?: () => void;
}

/**
 * Persistent banner indicating this is a prototype demonstration.
 * Includes a one-click demo reset button for live hackathon presentations.
 * Per 20_FINAL_PRODUCTION_AUDIT.md: "Add clear Prototype / Demo indicators where appropriate."
 */
export const DemoBanner: React.FC<DemoBannerProps> = ({ onReset }) => {
  const handleReset = () => {
    resetDemoStore();
    if (onReset) {
      onReset();
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center justify-between gap-2 text-amber-900"
      role="status"
      aria-label="Prototype demonstration mode"
    >
      <div className="flex items-center gap-2 text-[11px] font-medium">
        <FlaskConical className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>
          <strong>Prototype / Demo</strong> — Synthetic data only. Not clinically validated.
        </span>
      </div>
      <button
        onClick={handleReset}
        className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-md border border-amber-300 transition-colors shrink-0"
        title="Reset all demo data to initial state"
        aria-label="Reset demo data"
      >
        <RotateCcw className="w-3 h-3" />
        Reset Demo
      </button>
    </div>
  );
};
