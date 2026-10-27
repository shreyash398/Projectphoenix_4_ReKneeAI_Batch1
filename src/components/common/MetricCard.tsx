import React from 'react';
import { Card } from './Card';

interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    text: string;
  };
  onClick?: () => void;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  sublabel,
  icon,
  iconBgColor = 'bg-teal-light',
  iconColor = 'text-teal-calm',
  trend,
  onClick,
  className = '',
}) => {
  return (
    <Card
      onClick={onClick}
      className={`p-3.5 sm:p-4 text-left ${onClick ? 'cursor-pointer hover:border-teal-calm/60 transition-all' : ''} ${className}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[10px] sm:text-[11px] font-bold text-slate-subtle uppercase tracking-wider truncate">
          {label}
        </p>
        {icon && (
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${iconBgColor} ${iconColor} flex items-center justify-center shrink-0 shadow-soft`}
          >
            {icon}
          </div>
        )}
      </div>

      <p className="text-xl sm:text-2xl font-bold text-navy-900 tracking-tight leading-none mb-1 tabular-nums">
        {value}
      </p>

      {(sublabel || trend) && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-muted">
          {trend && (
            <span
              className={`font-semibold ${
                trend.direction === 'up'
                  ? 'text-status-success'
                  : trend.direction === 'down'
                  ? 'text-status-warning'
                  : 'text-slate-muted'
              }`}
            >
              {trend.text}
            </span>
          )}
          {sublabel && <span className="truncate">{sublabel}</span>}
        </div>
      )}
    </Card>
  );
};
