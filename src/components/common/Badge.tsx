import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'engagement' | 'neutral' | 'teal';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  icon,
}) => {
  const variantClasses = {
    success: 'bg-status-success-bg text-status-success border-emerald-200',
    warning: 'bg-status-warning-bg text-status-warning border-amber-200',
    error: 'bg-status-error-bg text-status-error border-red-200',
    engagement: 'bg-status-engagement-bg text-status-engagement border-blue-200',
    neutral: 'bg-warm-subtle text-slate-muted border-warm-border',
    teal: 'bg-teal-light text-teal-calm border-teal-border',
  }[variant];

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs font-medium px-2.5 py-1 gap-1.5',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border leading-none shrink-0 ${variantClasses} ${sizeClasses} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
