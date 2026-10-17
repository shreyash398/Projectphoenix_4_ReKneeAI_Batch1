import React from 'react';
import { Clock, ShieldAlert, HeartHandshake, CheckCircle2 } from 'lucide-react';
import { Card } from './Card';
import { Badge, BadgeVariant } from './Badge';
import { Button } from './Button';
import { Alert } from '../../types/database';

interface AlertCardProps {
  alert: Alert;
  onReview?: (alert: Alert) => void;
  className?: string;
}

export const AlertCard: React.FC<AlertCardProps> = ({ alert, onReview, className = '' }) => {
  const getSeverityBadgeVariant = (sev: Alert['severity']): BadgeVariant => {
    switch (sev) {
      case 'critical':
        return 'error';
      case 'urgent':
        return 'warning';
      case 'moderate':
        return 'engagement';
      default:
        return 'neutral';
    }
  };

  const isClinical = alert.category === 'clinical_review';

  return (
    <Card
      className={`p-4 transition-all ${
        alert.status === 'new'
          ? isClinical
            ? 'border-l-4 border-l-status-warning bg-amber-50/15'
            : 'border-l-4 border-l-status-engagement bg-blue-50/15'
          : 'bg-white opacity-85'
      } ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Badge variant={getSeverityBadgeVariant(alert.severity)} size="sm">
            {alert.severity.toUpperCase()}
          </Badge>
          <span className="text-[11px] font-semibold text-slate-subtle uppercase flex items-center gap-1">
            {isClinical ? (
              <>
                <ShieldAlert className="w-3 h-3 text-status-warning" />
                <span>Clinical Review</span>
              </>
            ) : (
              <>
                <HeartHandshake className="w-3 h-3 text-status-engagement" />
                <span>Engagement Reminder</span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-muted">
          <Clock className="w-3.5 h-3.5" />
          <span>
            {new Date(alert.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <Badge variant={alert.status === 'new' ? 'warning' : 'success'} size="sm">
            {alert.status === 'new' ? 'Action Required' : 'Reviewed'}
          </Badge>
        </div>
      </div>

      <p className="text-xs sm:text-sm font-medium text-navy-900 mb-3 leading-relaxed">
        {alert.reason}
      </p>

      <div className="flex items-center justify-between pt-2 border-t border-warm-border/70 text-xs">
        <span className="text-[11px] text-slate-subtle">
          Source: <strong className="text-navy-900 capitalize">{alert.source_type.replace('_', ' ')}</strong>
        </span>

        {alert.status === 'new' && onReview ? (
          <Button size="sm" variant="primary" onClick={() => onReview(alert)}>
            Review & Sign Off
          </Button>
        ) : (
          <span className="text-[11px] text-status-success font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Clinical Sign-off Recorded
          </span>
        )}
      </div>
    </Card>
  );
};
