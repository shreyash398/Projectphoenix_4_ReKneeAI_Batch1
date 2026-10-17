import React from 'react';

interface ProgressBarProps {
  value: number; // current value
  max?: number; // default 100
  label?: string;
  sublabel?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'teal' | 'success' | 'warning' | 'navy';
  showPercentage?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  sublabel,
  size = 'md',
  variant = 'teal',
  showPercentage = true,
  className = '',
}) => {
  const percentage = Math.min(Math.max(Math.round((value / max) * 100), 0), 100);

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5',
  }[size];

  const barVariants = {
    teal: 'bg-teal-calm',
    success: 'bg-status-success',
    warning: 'bg-status-warning',
    navy: 'bg-navy-900',
  }[variant];

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs">
          {label && (
            <span className="font-semibold text-navy-900">
              {label} {sublabel && <span className="font-normal text-slate-muted">({sublabel})</span>}
            </span>
          )}
          {showPercentage && (
            <span className="text-slate-muted font-medium tabular-nums text-[11px] ml-auto">
              {percentage}%
            </span>
          )}
        </div>
      )}

      <div
        className={`w-full bg-warm-subtle rounded-full overflow-hidden border border-warm-border/60 ${sizeClasses}`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || 'Progress'}
      >
        <div
          className={`${sizeClasses} ${barVariants} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
