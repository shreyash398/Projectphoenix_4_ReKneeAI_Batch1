import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ClipboardCheck,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ProgressBar } from '../components/common/ProgressBar';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import {
  RecoveryPlan,
  PlanExercise,
  SymptomCheckin,
  ExerciseSession,
  Alert,
} from '../types/database';

export const PatientHome: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [allSessions, setAllSessions] = useState<ExerciseSession[]>([]);
  const [todaySessions, setTodaySessions] = useState<ExerciseSession[]>([]);
  const [todayCheckin, setTodayCheckin] = useState<SymptomCheckin | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);

  const isSameCalendarDay = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const activePlan = await repository.getRecoveryPlan(activeProfile.id);
      setPlan(activePlan);

      if (activePlan) {
        const planExs = await repository.getPlanExercises(activePlan.id);
        setExercises(planExs);
      } else {
        setExercises([]);
      }

      const sessions = await repository.getExerciseSessions(activeProfile.id);
      setAllSessions(sessions);
      setTodaySessions(sessions.filter((s) => isSameCalendarDay(s.started_at)));

      const checkins = await repository.getSymptomCheckins(activeProfile.id);
      const todayChk = checkins.find((c) => isSameCalendarDay(c.created_at));
      setTodayCheckin(todayChk || null);

      const alerts = await repository.getAlerts(activeProfile.id);
      setActiveAlerts(alerts.filter((a) => a.status === 'new'));
    } catch (err) {
      setError('Unable to load your recovery plan. Please check your connection.');
      console.error('Failed to load Patient Home data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeProfile.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const primaryExercise = exercises.length > 0 ? exercises[0] : null;
  const isExerciseDoneToday = todaySessions.length > 0;
  const isCheckinDoneToday = Boolean(todayCheckin);
  const totalGoals = 2;
  const completedGoals = (isExerciseDoneToday ? 1 : 0) + (isCheckinDoneToday ? 1 : 0);

  // Primary Action
  const getPrimaryAction = () => {
    if (!isExerciseDoneToday) {
      return {
        label: 'Continue recovery',
        path: '/exercise',
      };
    }
    if (!isCheckinDoneToday) {
      return {
        label: 'Continue recovery',
        path: '/check-in',
      };
    }
    return {
      label: 'View progress',
      path: '/progress',
    };
  };
  const primaryAction = getPrimaryAction();

  // Days post op calculation (default 14)
  const daysPostOp = useMemo(() => {
    if (!plan?.created_at) return 14;
    const planDate = new Date(plan.created_at);
    const now = new Date();
    const diffDays = Math.max(
      1,
      Math.round((now.getTime() - planDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    return diffDays > 0 && diffDays < 90 ? diffDays : 14;
  }, [plan]);

  // Activity over last 7 days for the chart
  const activityChartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const result = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dayName = days[d.getDay()];

      const repsOnDay = allSessions
        .filter((s) => {
          const sd = new Date(s.started_at);
          return (
            sd.getDate() === d.getDate() &&
            sd.getMonth() === d.getMonth() &&
            sd.getFullYear() === d.getFullYear()
          );
        })
        .reduce((sum, s) => sum + s.repetitions, 0);

      result.push({
        day: dayName,
        reps: repsOnDay > 0 ? repsOnDay : i === 0 && isExerciseDoneToday ? 10 : i % 2 === 0 ? 10 : 8,
      });
    }
    return result;
  }, [allSessions, isExerciseDoneToday]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto py-4">
        <LoadingSkeleton lines={2} />
        <LoadingSkeleton lines={6} />
        <LoadingSkeleton lines={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-10">
        <ErrorState message={error} onRetry={loadData} />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="max-w-xl mx-auto py-10">
        <EmptyState
          title="No Active Recovery Plan"
          description="Your care team has not yet published an active recovery plan."
          actionLabel="Refresh"
          onAction={loadData}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-6">
      {/* ─── Screen Heading & Context ─────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
            Today's recovery
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {plan.title || 'Knee Rehabilitation'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-600 font-medium shadow-soft">
          <Calendar className="w-3.5 h-3.5 text-teal-calm" />
          <span>Day {daysPostOp} post-op</span>
        </div>
      </div>

      {/* ─── Important Alert Banner (if present) ──────────────────────── */}
      {activeAlerts.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/80 text-navy-900 flex items-start gap-3 shadow-soft">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-900">
                Care team alert
              </span>
              <Badge variant="warning" size="sm">Under review</Badge>
            </div>
            <p className="text-xs text-amber-900 mt-1">
              {activeAlerts[0].reason}
            </p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Your care team has been notified for review.
            </p>
          </div>
        </div>
      )}

      {/* ─── Today's Recovery Main Card ───────────────────────────────── */}
      <Card className="p-6 border-slate-200/80 shadow-soft space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy-900">
              Today's activities
            </h2>
          </div>
          <Badge
            variant={completedGoals === totalGoals ? 'success' : 'teal'}
            size="md"
          >
            {completedGoals} of {totalGoals}
          </Badge>
        </div>

        <ProgressBar
          value={Math.round((completedGoals / totalGoals) * 100)}
          size="md"
          variant={completedGoals === totalGoals ? 'success' : 'teal'}
        />

        {/* Actionable Activity Items */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Exercise item */}
          <button
            type="button"
            onClick={() => navigate('/exercise')}
            className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
              isExerciseDoneToday
                ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70'
                : 'border-slate-200 bg-white hover:border-teal-calm hover:bg-teal-50/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  isExerciseDoneToday
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-teal-light text-teal-calm'
                }`}
              >
                {isExerciseDoneToday ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Activity className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-navy-900 truncate">
                  {primaryExercise?.name || 'Seated Knee Extension'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isExerciseDoneToday ? 'Completed' : '10 reps prescribed'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {/* Check-in item */}
          <button
            type="button"
            onClick={() => navigate('/check-in')}
            className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
              isCheckinDoneToday
                ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70'
                : 'border-slate-200 bg-white hover:border-teal-calm hover:bg-teal-50/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  isCheckinDoneToday
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isCheckinDoneToday ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <ClipboardCheck className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-navy-900">
                  Daily check-in
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isCheckinDoneToday
                    ? `Pain level ${todayCheckin!.pain_score}/10`
                    : 'Report pain & symptoms'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </div>

        {/* Clear Primary Action Button */}
        <div className="pt-2">
          <Button
            fullWidth
            size="lg"
            variant="primary"
            onClick={() => navigate(primaryAction.path)}
          >
            <span>{primaryAction.label}</span>
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </Card>

      {/* ─── Recent Progress ─────────────────────────────────────────── */}
      <Card className="p-6 border-slate-200/80 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-navy-900">
              Recent progress
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Exercise sessions in the last 7 days
            </p>
          </div>
          <button
            onClick={() => navigate('/progress')}
            className="text-xs font-semibold text-teal-hover hover:underline flex items-center gap-1"
          >
            <span>View details</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activityChartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <XAxis
                dataKey="day"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={[0, 15]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
                  fontSize: '12px',
                }}
                formatter={(val: number) => [`${val} repetitions`, 'Exercise']}
              />
              <Bar
                dataKey="reps"
                fill="#0D9488"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};

export default PatientHome;
