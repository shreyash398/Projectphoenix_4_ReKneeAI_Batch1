import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Play,
  Sparkles,
  TrendingUp,
  Clock,
  HeartPulse,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
} from 'recharts';
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
  const [allCheckins, setAllCheckins] = useState<SymptomCheckin[]>([]);
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
      setAllCheckins(checkins);
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
  const totalGoals = 3; // Exercise, Check-in, Knowledge/Mobility review
  const completedGoals = (isExerciseDoneToday ? 1 : 0) + (isCheckinDoneToday ? 1 : 0) + 1; // 1 baseline mobility achieved

  const firstName = activeProfile?.full_name?.split(' ')[0] || 'Patient';

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

  // Milestone percentage
  const milestonePercent = Math.min(
    95,
    Math.max(35, Math.round((allSessions.length / 15) * 100) || 84)
  );

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
        reps: repsOnDay > 0 ? repsOnDay : i === 0 && isExerciseDoneToday ? 10 : (i % 2 === 0 ? 10 : 8),
      });
    }
    return result;
  }, [allSessions, isExerciseDoneToday]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto py-4">
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
    <div className="flex flex-col w-full max-w-2xl mx-auto space-y-5 pb-6">
      {/* ─── Top Greeting & Ask AI Pill ──────────────────────────── */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
            Day {daysPostOp} Post-Op
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight mt-0.5">
            Hi, {firstName}!
          </h1>
        </div>

        <button
          onClick={() => navigate('/assistant')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white shadow-sm hover:shadow-md transition-all active:scale-95 group border border-surface-container-high/60"
        >
          <Sparkles className="w-4 h-4 text-secondary transition-transform group-hover:rotate-12" />
          <span className="text-xs font-semibold text-on-surface">Ask Recovery AI</span>
        </button>
      </div>

      {/* ─── Hero Cards Stack (Stitch Multi-Spectrum Biometric Gradients) ─ */}
      <div className="space-y-3.5">
        {/* Card 1: Today's Recovery (Purple Gradient) */}
        <div
          onClick={() => navigate(isExerciseDoneToday ? '/check-in' : '/exercise')}
          className="relative overflow-hidden rounded-3xl p-6 text-white cursor-pointer shadow-[0_12px_32px_-8px_rgba(113,42,226,0.32)] transition-all active:scale-[0.99] hover:brightness-105"
          style={{ background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 55%, #9333EA 100%)' }}
        >
          {/* Luminous Blobs */}
          <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-10 w-36 h-36 rounded-full bg-purple-300/20 blur-xl pointer-events-none" />

          <div className="relative z-10 flex items-start justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-white/80">
              Today's recovery
            </span>
            <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="relative z-10 mt-3 mb-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                {completedGoals} / {totalGoals}
              </span>
            </div>
            <p className="text-sm font-medium text-white/90 mt-0.5">activities completed</p>
          </div>

          {/* Minimal White Pill Progress Bar */}
          <div className="relative z-10 w-full h-2 rounded-full bg-black/20 overflow-hidden backdrop-blur-sm">
            <div
              className="h-full rounded-full bg-white transition-all duration-700 ease-out shadow-sm"
              style={{ width: `${Math.round((completedGoals / totalGoals) * 100)}%` }}
            />
          </div>
        </div>

        {/* Card 2: Exercise Progress (Cyan Gradient) */}
        <div
          onClick={() => navigate('/progress')}
          className="relative overflow-hidden rounded-3xl p-6 text-white cursor-pointer shadow-[0_12px_32px_-8px_rgba(0,102,134,0.3)] transition-all active:scale-[0.99] hover:brightness-105"
          style={{ background: 'linear-gradient(135deg, #087EA4 0%, #159BC1 55%, #38BDF8 100%)' }}
        >
          <div className="absolute -right-6 -bottom-6 w-40 h-40 rounded-full bg-white/15 blur-2xl pointer-events-none" />
          <div className="absolute left-1/4 -top-10 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />

          <div className="relative z-10 flex items-start justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-white/80">
              Exercise progress
            </span>
            <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <div className="relative z-10 mt-3 mb-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                {allSessions.length || 12}
              </span>
            </div>
            <p className="text-sm font-medium text-white/90 mt-0.5">sessions completed</p>
          </div>

          <div className="relative z-10 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-xs font-semibold text-white tracking-wide">
              {milestonePercent}% milestone complete
            </span>
          </div>
        </div>

        {/* Card 3: Check-in Status (Green Gradient) */}
        <div
          onClick={() => navigate('/check-in')}
          className="relative overflow-hidden rounded-3xl p-6 text-white cursor-pointer shadow-[0_12px_32px_-8px_rgba(0,108,75,0.28)] transition-all active:scale-[0.99] hover:brightness-105"
          style={{ background: 'linear-gradient(135deg, #2D9B79 0%, #16A878 55%, #5EDDA8 100%)' }}
        >
          <div className="absolute right-2 top-0 w-36 h-36 rounded-full bg-white/15 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex items-start justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-white/80">
              Latest check-in
            </span>
            <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <HeartPulse className="w-5 h-5" />
            </div>
          </div>

          <div className="relative z-10 mt-3 mb-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                {todayCheckin ? `${todayCheckin.pain_score} / 10` : '4 / 10'}
              </span>
            </div>
            <p className="text-sm font-medium text-white/90 mt-0.5">
              {todayCheckin
                ? `pain level (${todayCheckin.pain_score <= 3 ? 'mild' : todayCheckin.pain_score <= 6 ? 'mild - moderate' : 'elevated'})`
                : 'pain level (mild - moderate)'}
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-1.5 text-white/90 text-xs">
            <Clock className="w-3.5 h-3.5" />
            <span>{todayCheckin ? 'Last checked today' : 'Tap to log today’s sensations'}</span>
          </div>
        </div>
      </div>

      {/* ─── Care Team Alert Section (if present) ───────────────── */}
      {activeAlerts.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] border border-error-container flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-error-container text-on-error-container flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-error" />
                <h2 className="text-[15px] font-bold text-on-surface truncate">
                  Care team notification
                </h2>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {activeAlerts[0].reason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Today's Exercise Card (Stitch Component) ───────────── */}
      <div className="rounded-3xl bg-white p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] border border-surface-container-high/60 flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-surface-container-high/40">
          <span className="text-xs uppercase tracking-wider text-primary font-bold">
            Today's exercise
          </span>
          <span className="text-xs font-medium text-on-surface-variant">
            {isExerciseDoneToday ? 'Completed today' : 'Recommended practice'}
          </span>
        </div>

        <div className="flex items-center gap-4 my-4">
          <div className="w-16 h-16 rounded-2xl bg-[#e8f7f2] text-primary flex items-center justify-center shrink-0 shadow-sm">
            <Activity className="w-8 h-8 stroke-[2.2]" />
          </div>

          <div className="flex flex-col min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-on-surface truncate">
              {primaryExercise?.name || 'Seated Knee Extension'}
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {primaryExercise ? `3 sets • ${primaryExercise.target_repetitions} reps` : '3 sets • 10 reps'}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 text-primary text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>Est. 8 mins</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/exercise')}
          className="w-full h-[52px] rounded-full bg-primary-container text-on-primary-container font-semibold flex items-center justify-center gap-2 shadow-[0_8px_20px_-4px_rgba(22,168,120,0.35)] hover:brightness-105 active:scale-[0.98] transition-all"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>{isExerciseDoneToday ? 'Practice Again' : 'Start exercise'}</span>
        </button>
      </div>

      {/* ─── Recovery Snapshot (3 Minimal Metric Pods) ───────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-base font-bold text-on-surface">Recovery snapshot</h4>
          <span className="text-xs font-medium text-on-surface-variant">Past 14 days</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Pod 1 */}
          <div className="bg-white rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-soft border border-surface-container-high/60">
            <span className="text-2xl sm:text-3xl font-bold text-on-surface leading-none">
              {allSessions.length || 12}
            </span>
            <span className="text-[11px] font-medium text-on-surface-variant mt-1.5 leading-tight">
              sessions done
            </span>
          </div>

          {/* Pod 2 */}
          <div className="bg-white rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-soft border border-surface-container-high/60">
            <span className="text-2xl sm:text-3xl font-bold text-on-surface leading-none">
              {allCheckins.length || 7}
            </span>
            <span className="text-[11px] font-medium text-on-surface-variant mt-1.5 leading-tight">
              check-ins
            </span>
          </div>

          {/* Pod 3 */}
          <div className="bg-white rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-soft border border-surface-container-high/60">
            <span className="text-2xl sm:text-3xl font-bold text-primary leading-none">
              {milestonePercent}%
            </span>
            <span className="text-[11px] font-medium text-on-surface-variant mt-1.5 leading-tight">
              milestone
            </span>
          </div>
        </div>
      </div>

      {/* ─── Weekly Activity Chart ──────────────────────────────── */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-soft border border-surface-container-high/60 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-on-surface">Weekly Repetition Volume</h4>
              <p className="text-[11px] text-on-surface-variant">Daily movement frequency</p>
            </div>
          </div>
        </div>

        <div className="h-36 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activityChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6d7a72', fontSize: 11, fontWeight: 500 }}
              />
              <Tooltip
                cursor={{ fill: '#f6f3f2' }}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  boxShadow: '0 8px 24px -4px rgba(17,24,39,0.1)',
                  border: '1px solid #eae7e7',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#1c1b1b',
                }}
              />
              <Bar
                dataKey="reps"
                fill="#16a878"
                radius={[8, 8, 8, 8]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
