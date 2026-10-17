import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-warm-subtle/50 rounded-xl border border-dashed border-warm-border my-4">
      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-slate-muted mb-3 shadow-soft">
        {icon || <HelpCircle className="w-6 h-6 text-teal-calm" />}
      </div>
      <h3 className="text-base font-semibold text-navy-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-muted max-w-sm mb-4 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
