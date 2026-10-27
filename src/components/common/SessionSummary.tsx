import React from 'react';
import { CheckCircle2, Clock, Activity, Award } from 'lucide-react';
import { Card } from './Card';
import { Badge } from './Badge';
import { ExerciseSession } from '../../types/database';

interface SessionSummaryProps {
  session: ExerciseSession;
  exerciseName?: string;
  className?: string;
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({
  session,
  exerciseName = 'Seated Knee Flexion & Extension',
  className = '',
}) => {
  const isCompleted = session.status === 'completed';

  return (
    <Card className={`p-4 sm:p-5 space-y-3.5 bg-white ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[10px] font-bold text-teal-calm uppercase tracking-wider block mb-0.5">
            Logged Mobility Practice
          </span>
          <h3 className="text-sm sm:text-base font-bold text-navy-900">{exerciseName}</h3>
        </div>
        <Badge variant={isCompleted ? 'success' : 'warning'} size="sm">
          {isCompleted ? 'Completed' : 'Stopped Early'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-warm-bg/70 p-3 rounded-xl border border-warm-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-light text-teal-calm flex items-center justify-center shrink-0">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-subtle uppercase font-semibold">Repetitions</p>
            <p className="text-sm font-bold text-navy-900">{session.repetitions} reps</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-subtle uppercase font-semibold">Duration</p>
            <p className="text-sm font-bold text-navy-900">{session.duration_seconds}s</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Award className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-subtle uppercase font-semibold">Tracking</p>
            <p className="text-xs font-semibold text-navy-900">
              {session.measurement_mode === 'manual_demo'
                ? 'Guided Motion'
                : 'Camera Vision'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-subtle uppercase font-semibold">Recorded</p>
            <p className="text-xs font-semibold text-navy-900">
              {new Date(session.started_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};
