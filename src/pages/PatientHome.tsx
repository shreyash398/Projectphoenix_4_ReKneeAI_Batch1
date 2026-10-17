import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Activity,
  ClipboardCheck,
  ChevronRight,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorState } from '../components/common/ErrorState';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import { RecoveryPlan, PlanExercise, SymptomCheckin, ExerciseSession } from '../types/database';

export const PatientHome: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getCurrentProfile();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [exercise, setExercise] = useState<PlanExercise | null>(null);
  const [recentSessions, setRecentSessions] = useState<ExerciseSession[]>([]);
  const [todayCheckin, setTodayCheckin] = useState<SymptomCheckin | null>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const activePlan = await repository.getRecoveryPlan(activeProfile.id);
      setPlan(activePlan);

      if (activePlan) {
        const exercises = await repository.getPlanExercises(activePlan.id);
        if (exercises.length > 0) {
          setExercise(exercises[0]);
        }
      }

      const sessions = await repository.getExerciseSessions(activeProfile.id);
      setRecentSessions(sessions.slice(0, 3));

      const checkins = await repository.getSymptomCheckins(activeProfile.id);
      const isToday = (dateStr: string) => {
        const d = new Date(dateStr);
        const today = new Date();
        return (
          d.getDate() === today.getDate() &&
          d.getMonth() === today.getMonth() &&
          d.getFullYear() === today.getFullYear()
        );
      };
      const today = checkins.find((c) => isToday(c.created_at));
      setTodayCheckin(today || null);
    } catch (err) {
      setError('Unable to load your recovery plan. Please check your connection.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [activeProfile.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton lines={2} />
        <LoadingSkeleton lines={4} />
        <LoadingSkeleton lines={3} />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Welcome & Day Header */}
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-teal-calm tracking-wide uppercase">
            Day 14 Post-Operation
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-900 tracking-tight mt-0.5">
            Welcome back, Eleanor
          </h1>
          <p className="text-xs sm:text-sm text-slate-muted mt-0.5">
            Keep up with your approved gentle movements and check in daily.
          </p>
        </div>
        <Badge variant="teal" icon={<Calendar className="w-3.5 h-3.5" />}>
          Week 2 Protocol
        </Badge>
      </div>

      {/* Primary Action Card: Today's Prescribed Exercise */}
      <Card highlight className="relative overflow-hidden bg-gradient-to-br from-white to-warm-subtle/30">
        <div className="flex items-center justify-between mb-3">
          <Badge variant="teal">Today’s Prescribed Movement</Badge>
          <div className="flex items-center text-xs text-slate-muted gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>~3 mins</span>
          </div>
        </div>

        {exercise ? (
          <div>
            <h2 className="text-lg font-bold text-navy-900 mb-1">{exercise.name}</h2>
            <p className="text-xs text-slate-muted line-clamp-2 leading-relaxed mb-4">
              {exercise.instructions}
            </p>

            <div className="grid grid-cols-2 gap-2 mb-4 bg-white p-2.5 rounded-lg border border-warm-border text-center">
              <div>
                <p className="text-[11px] text-slate-subtle uppercase font-semibold">Target Reps</p>
                <p className="text-base font-bold text-navy-900">{exercise.target_repetitions} reps</p>
              </div>
              <div className="border-l border-warm-border">
                <p className="text-[11px] text-slate-subtle uppercase font-semibold">Guidance Mode</p>
                <p className="text-base font-bold text-teal-calm">Camera Assist</p>
              </div>
            </div>

            <Button
              fullWidth
              size="lg"
              onClick={() => navigate('/exercise')}
              icon={<Activity className="w-5 h-5" />}
            >
              Start Exercise Practice
            </Button>
          </div>
        ) : (
          <p className="text-sm text-slate-muted">No exercises assigned to this plan yet.</p>
        )}
      </Card>

      {/* Daily Check-In Prompt Card */}
      <Card className="hover:border-teal-calm/50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                todayCheckin
                  ? 'bg-status-success-bg text-status-success'
                  : 'bg-warm-subtle text-teal-calm'
              }`}
            >
              {todayCheckin ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <ClipboardCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-navy-900 text-sm">Daily Symptom Check-in</h3>
                {todayCheckin ? (
                  <Badge variant="success" size="sm">
                    Submitted
                  </Badge>
                ) : (
                  <Badge variant="warning" size="sm">
                    Pending Today
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-muted mt-0.5">
                {todayCheckin
                  ? `Logged pain score: ${todayCheckin.pain_score}/10`
                  : 'Record your joint pain, swelling, and notes for your physical therapist.'}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant={todayCheckin ? 'outline' : 'primary'}
            onClick={() => navigate('/check-in')}
            icon={<ChevronRight className="w-4 h-4" />}
          >
            {todayCheckin ? 'Review' : 'Log Now'}
          </Button>
        </div>
      </Card>

      {/* Recovery Knowledge Assistant Quick Prompt */}
      <Card
        onClick={() => navigate('/assistant')}
        className="cursor-pointer hover:border-teal-calm/60 transition-all group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-light text-teal-calm flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-navy-900 text-sm">Have a Recovery Question?</h3>
              <p className="text-xs text-slate-muted mt-0.5">
                Ask questions answered strictly from your clinician-approved instructions.
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-muted group-hover:text-teal-calm transition-colors" />
        </div>
      </Card>

      {/* Recent Sessions Summary */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-slate-muted uppercase tracking-wider">
            Recent Practice Activity
          </h3>
          <button
            onClick={() => navigate('/progress')}
            className="text-xs text-teal-calm hover:text-teal-hover font-medium flex items-center gap-0.5"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentSessions.length === 0 ? (
          <Card>
            <p className="text-xs text-slate-muted text-center py-2">
              No exercise sessions completed yet. Start your first session above!
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentSessions.map((session) => (
              <Card key={session.id} className="py-3 px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-light text-teal-calm flex items-center justify-center font-bold text-xs">
                    {session.repetitions}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-navy-900">
                      {plan?.title || 'Mobility Practice'}
                    </p>
                    <p className="text-[11px] text-slate-subtle">
                      {new Date(session.started_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      • {session.duration_seconds}s
                    </p>
                  </div>
                </div>
                <Badge variant={session.status === 'completed' ? 'success' : 'neutral'} size="sm">
                  {session.status === 'completed' ? 'Completed' : 'Partial'}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Safety Notice & Emergency Card */}
      <div className="p-3.5 rounded-xl bg-warm-subtle border border-warm-border flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-status-warning shrink-0 mt-0.5" />
        <div className="text-xs text-slate-muted leading-relaxed">
          <span className="font-semibold text-navy-900 block mb-0.5">Safety & Escalation Notice:</span>
          ReKnee AI provides guidance only and does not diagnose or make medication changes. If you experience sudden shortness of breath, chest pain, or severe calf swelling, call emergency services immediately.
        </div>
      </div>
    </div>
  );
};
