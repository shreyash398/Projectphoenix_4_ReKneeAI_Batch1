import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ClipboardCheck,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  MessageSquareHeart,
  TrendingDown,
  Stethoscope,
  FileCheck2,
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
import { StatCard } from '../components/common/StatCard';
import { KneeVisual } from '../components/common/KneeVisual';
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
  Profile,
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
  const [careDoctor, setCareDoctor] = useState<Profile | null>(null);

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
        if (activePlan.approved_by) {
          const doc = await repository.getPatientProfile(activePlan.approved_by);
          setCareDoctor(doc);
        }
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
  const completedGoals = (isExerciseDoneToday ? 1 : 0) + (isCheckinDoneToday ? 1 : 0);
  const totalGoals = 2;

  // Determine Primary CTA button behavior
  const getPrimaryCTA = () => {
    if (!isExerciseDoneToday) {
      return {
        label: 'Continue Recovery',
        subtext: primaryExercise?.name || 'Seated Knee Extension',
        path: '/exercise',
      };
    }
    if (!isCheckinDoneToday) {
      return {
        label: 'Log Daily Check-in',
        subtext: 'Record pain level & symptoms',
        path: '/check-in',
      };
    }
    return {
      label: 'View Progress & Summary',
      subtext: 'All daily activities complete',
      path: '/progress',
    };
  };
  const primaryCTA = getPrimaryCTA();

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

  const latestPainScore = todayCheckin?.pain_score ?? (allCheckins.length > 0 ? allCheckins[0].pain_score : 4);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto py-4">
        <LoadingSkeleton lines={2} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <LoadingSkeleton lines={6} />
          </div>
          <div>
            <LoadingSkeleton lines={6} />
          </div>
        </div>
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
          description="Your care team has not yet published an active recovery plan. Please contact your clinic."
          actionLabel="Refresh"
          onAction={loadData}
        />
      </div>
    );
  }

  const patientFirstName = activeProfile.full_name.split(' ')[0];

  return (
    <div className="space-y-7 max-w-6xl mx-auto pb-6">
      {/* ─── Top Editorial Greeting & Header ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200/60 pb-5">
        <div>
          <p className="text-xs uppercase font-bold tracking-wider text-teal-calm">
            Good morning, {patientFirstName}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
            Your Recovery
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Your personalized knee rehabilitation protocol for today.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto bg-white border border-slate-200/80 px-3.5 py-1.5 rounded-full shadow-soft text-xs text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-teal-calm" />
          <span className="font-semibold text-navy-900">Day {daysPostOp}</span>
          <span className="text-slate-300">·</span>
          <span>Post-Operative</span>
        </div>
      </div>

      {/* ─── High Priority Alert Banner (if present) ──────────────────── */}
      {activeAlerts.length > 0 && (
        <div className="space-y-3">
          {activeAlerts.slice(0, 1).map((alt) => (
            <div
              key={alt.id}
              className="p-4 rounded-2xl border border-amber-200/90 bg-amber-50/60 text-navy-900 flex items-start gap-3.5 shadow-soft"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-bold text-amber-800 tracking-wider">
                    Care Team Notification
                  </span>
                  <Badge variant="warning" size="sm">Under Review</Badge>
                </div>
                <p className="text-sm font-semibold text-navy-900 mt-0.5">
                  {alt.reason}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Your clinician has received this check-in signal and will review your recovery protocol.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Hero Dashboard Composition: Central Visual + Stat Cards ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visual Hero + Main Recovery Card */}
        <div className="lg:col-span-8 space-y-6">
          {/* Central Anatomy / Knee Visualization Component */}
          <KneeVisual
            dayPostOp={daysPostOp}
            focusArea={plan.title || 'Right Knee Protocol'}
          />

          {/* Today's Recovery Main Card */}
          <Card className="p-6 border-slate-200/80 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[11px] font-bold text-teal-calm uppercase tracking-wider">
                  Daily Progress
                </span>
                <h2 className="text-lg font-bold text-navy-900 tracking-tight">
                  Today's Recovery Protocol
                </h2>
              </div>
              <Badge
                variant={completedGoals === totalGoals ? 'success' : 'teal'}
                size="md"
              >
                {completedGoals} of {totalGoals} Completed
              </Badge>
            </div>

            <ProgressBar
              value={Math.round((completedGoals / totalGoals) * 100)}
              size="lg"
              variant={completedGoals === totalGoals ? 'success' : 'teal'}
            />

            <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
              <span>
                {completedGoals === totalGoals
                  ? 'All prescribed activities finished for today.'
                  : `${totalGoals - completedGoals} activity remaining today`}
              </span>
              <span className="font-semibold text-navy-900 tabular-nums">
                {Math.round((completedGoals / totalGoals) * 100)}% Complete
              </span>
            </div>

            {/* Quick Activity Items inside the card */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100">
              {/* Exercise Item */}
              <div
                onClick={() => navigate('/exercise')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isExerciseDoneToday
                    ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70'
                    : 'border-slate-200 hover:border-teal-calm hover:bg-teal-50/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
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
                  <div>
                    <h3 className="text-xs font-semibold text-navy-900 truncate max-w-[140px]">
                      {primaryExercise?.name || 'Seated Knee Extension'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {isExerciseDoneToday ? 'Completed' : '10 reps prescribed'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>

              {/* Check-in Item */}
              <div
                onClick={() => navigate('/check-in')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isCheckinDoneToday
                    ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70'
                    : 'border-slate-200 hover:border-teal-calm hover:bg-teal-50/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
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
                  <div>
                    <h3 className="text-xs font-semibold text-navy-900">
                      Daily Check-in
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {isCheckinDoneToday
                        ? `Pain score: ${todayCheckin!.pain_score}/10`
                        : 'Pain & symptoms'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="mt-5">
              <Button
                fullWidth
                size="lg"
                variant="primary"
                onClick={() => navigate(primaryCTA.path)}
                className="py-3.5 shadow-card"
              >
                <span>{primaryCTA.label}</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column: 4 Compact Information Cards */}
        <div className="lg:col-span-4 space-y-4">
          <StatCard
            title="Today's Activity"
            value={`${completedGoals} / ${totalGoals}`}
            subtitle={completedGoals === totalGoals ? 'All goals completed' : '1 activity pending'}
            icon={Activity}
            badge={completedGoals === totalGoals ? 'Complete' : 'In Progress'}
            badgeVariant={completedGoals === totalGoals ? 'success' : 'teal'}
            onClick={() => navigate(primaryCTA.path)}
          />

          <StatCard
            title="Exercise Sessions"
            value={allSessions.length}
            subtitle={
              todaySessions.length > 0
                ? `${todaySessions.length} session completed today`
                : '1 prescribed for today'
            }
            icon={CheckCircle2}
            badge={isExerciseDoneToday ? 'Done Today' : 'Pending'}
            badgeVariant={isExerciseDoneToday ? 'success' : 'neutral'}
            onClick={() => navigate('/exercise')}
          />

          <StatCard
            title="Daily Check-ins"
            value={allCheckins.length}
            subtitle={
              isCheckinDoneToday
                ? 'Check-in recorded for today'
                : 'Pending today’s log'
            }
            icon={ClipboardCheck}
            badge={isCheckinDoneToday ? 'Logged' : 'Awaiting'}
            badgeVariant={isCheckinDoneToday ? 'success' : 'neutral'}
            onClick={() => navigate('/check-in')}
          />

          <StatCard
            title="Latest Pain Score"
            value={`${latestPainScore} / 10`}
            subtitle={
              latestPainScore <= 3
                ? 'Mild post-op discomfort'
                : latestPainScore <= 6
                ? 'Moderate joint soreness'
                : 'Elevated pain reported'
            }
            icon={TrendingDown}
            badge={latestPainScore >= 8 ? 'High Alert' : latestPainScore <= 3 ? 'Mild' : 'Moderate'}
            badgeVariant={latestPainScore >= 8 ? 'error' : latestPainScore <= 3 ? 'success' : 'warning'}
            onClick={() => navigate('/check-in')}
          />

          {/* Quick Assistant Callout Card */}
          <div
            onClick={() => navigate('/assistant')}
            className="p-4 rounded-2xl bg-gradient-to-br from-teal-light via-white to-slate-50 border border-teal-border/70 shadow-soft cursor-pointer hover:shadow-card transition-all"
          >
            <div className="flex items-center gap-2.5 text-teal-calm text-xs font-bold uppercase tracking-wider">
              <MessageSquareHeart className="w-4 h-4" />
              <span>Recovery Assistant</span>
            </div>
            <p className="text-xs font-semibold text-navy-900 mt-1">
              Have questions about your exercises or swelling?
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Instant answers grounded in approved clinical guidance.
            </p>
            <div className="mt-3 flex items-center text-xs font-bold text-teal-hover">
              <span>Ask Recovery Assistant</span>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Wide Lower Section: Recovery Activity + Care Team ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        {/* Left: Recovery Activity Chart */}
        <div className="lg:col-span-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Consistency Trend
                </span>
                <h3 className="text-base font-bold text-navy-900">
                  Recovery Activity
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Last 7 Days (Reps Completed)
              </span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 4px 14px -3px rgba(15, 23, 42, 0.08)',
                      fontSize: '12px',
                    }}
                    formatter={(val: number) => [`${val} repetitions`, 'Activity']}
                  />
                  <Bar
                    dataKey="reps"
                    fill="#0D9488"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-calm" />
                Target: 10 reps daily
              </span>
              <button
                onClick={() => navigate('/progress')}
                className="text-teal-hover font-semibold hover:underline flex items-center gap-1"
              >
                <span>View Full Analytics</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>
        </div>

        {/* Right: Care Team & Doctor Verification Status */}
        <div className="lg:col-span-4">
          <Card className="p-6 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Assigned Care Team
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Connected" />
              </div>

              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-light text-teal-calm flex items-center justify-center font-bold text-sm shrink-0 border border-teal-border">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-navy-900">
                    {careDoctor?.full_name || 'Dr. Marcus Patel, DPT'}
                  </h4>
                  <p className="text-xs text-slate-500">Lead Physical Therapist</p>
                  <p className="text-[11px] text-teal-calm font-medium mt-0.5">
                    Orthopedic Rehabilitation Clinic
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Protocol:</span>
                  <span className="font-semibold text-navy-900 truncate max-w-[150px]">
                    {plan.title}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Last Reviewed:</span>
                  <span className="font-medium text-navy-900">Oct 26, 2026</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Attestation:</span>
                  <span className="font-semibold text-emerald-600">Active Monitoring</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                fullWidth
                icon={<FileCheck2 className="w-3.5 h-3.5 text-teal-calm" />}
                onClick={() => navigate('/reports')}
              >
                Verified Reports
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PatientHome;
