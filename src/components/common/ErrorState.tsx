import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center bg-status-error-bg rounded-xl border border-red-200 my-4">
      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-status-error mb-2 shadow-soft">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-navy-900 mb-1">{title}</h3>
      <p className="text-xs text-slate-muted max-w-xs mb-3">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} icon={<RefreshCw className="w-3.5 h-3.5" />}>
          Try Again
        </Button>
      )}
    </div>
  );
};
