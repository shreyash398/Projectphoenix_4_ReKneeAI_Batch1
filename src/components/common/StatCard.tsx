import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: string;
  badgeVariant?: 'success' | 'warning' | 'teal' | 'neutral' | 'error';
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  badgeVariant = 'neutral',
  onClick,
  className = '',
}) => {
  const badgeClasses = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
    error: 'bg-rose-50 text-rose-700 border-rose-200',
  }[badgeVariant];

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-200/80 p-4 shadow-soft transition-all duration-200 flex flex-col justify-between ${
        onClick ? 'cursor-pointer hover:border-teal-calm/60 hover:shadow-card group' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-teal-50 text-slate-500 group-hover:text-teal-calm flex items-center justify-center transition-colors">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between mt-1">
        <span className="text-2xl font-bold tracking-tight text-navy-900 tabular-nums">
          {value}
        </span>
        {badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeClasses}`}>
            {badge}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-slate-400 font-medium mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
};
