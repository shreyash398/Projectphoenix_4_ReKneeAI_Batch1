import React, { useEffect, useState, useCallback } from 'react';
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
  ArrowRight,
  RotateCcw,
  FileText,
  Flame,
  Layers,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ProgressBar } from '../components/common/ProgressBar';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
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
  const activeProfile = profile || repository.getCurrentProfile();

  // State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [recentSessions, setRecentSessions] = useState<ExerciseSession[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<SymptomCheckin[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [todayCheckin, setTodayCheckin] = useState<SymptomCheckin | null>(null);
  const [todaySessions, setTodaySessions] = useState<ExerciseSession[]>([]);

  // Interactive controls
  const [showPlanModal, setShowPlanModal] = useState<boolean>(false);
  const [activityTab, setActivityTab] = useState<'all' | 'exercises' | 'checkins'>('all');
  const [iceSessionCount, setIceSessionCount] = useState<number>(() => {
    const saved = localStorage.getItem('reknee_ice_count_' + new Date().toDateString());
    return saved ? parseInt(saved, 10) : 2;
  });

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
      // 1. Load active recovery plan
      const activePlan = await repository.getRecoveryPlan(activeProfile.id);
      setPlan(activePlan);

      if (activePlan) {
        const planExs = await repository.getPlanExercises(activePlan.id);
        setExercises(planExs);
      } else {
        setExercises([]);
      }

      // 2. Load exercise sessions
      const sessions = await repository.getExerciseSessions(activeProfile.id);
      setRecentSessions(sessions);
      const todaysSess = sessions.filter((s) => isSameCalendarDay(s.started_at));
      setTodaySessions(todaysSess);

      // 3. Load check-ins
      const checkins = await repository.getSymptomCheckins(activeProfile.id);
      setRecentCheckins(checkins);
      const todayChk = checkins.find((c) => isSameCalendarDay(c.created_at));
      setTodayCheckin(todayChk || null);

      // 4. Load alerts
      const alerts = await repository.getAlerts(activeProfile.id);
      const openAlerts = alerts.filter((a) => a.status === 'new');
      setActiveAlerts(openAlerts);
    } catch (err) {
      setError('Unable to load your recovery plan. Please check your network connection.');
      console.error('Failed to load Patient Home data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeProfile.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle ice increment
  const handleLogIce = () => {
    const next = Math.min(iceSessionCount + 1, 4);
    setIceSessionCount(next);
    localStorage.setItem('reknee_ice_count_' + new Date().toDateString(), next.toString());
  };

  // Helper date calculations
  const calculateDaysPostOp = () => {
    if (!plan?.start_date) return 14;
    const start = new Date(plan.start_date);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(today.getTime() - start.getTime());
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(diffDays, 1);
  };

  const calculateProtocolProgress = () => {
    if (!plan?.start_date || !plan?.end_date) return 47;
    const start = new Date(plan.start_date).getTime();
    const end = new Date(plan.end_date).getTime();
    const now = Date.now();
    if (end <= start) return 50;
    const pct = Math.round(((now - start) / (end - start)) * 100);
    return Math.min(Math.max(pct, 5), 100);
  };

  const formatRelativeTimestamp = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);

    const timeString = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (isSameCalendarDay(dateStr)) {
      return `Today at ${timeString}`;
    }
    if (diffHours < 48) {
      return `Yesterday at ${timeString}`;
    }
    return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${timeString}`;
  };

  // Activity Statuses
  const primaryExercise = exercises.length > 0 ? exercises[0] : null;
  const isExerciseDoneToday = todaySessions.length > 0;
  const isCheckinDoneToday = Boolean(todayCheckin);
  const totalDailyGoals = 2;
  const completedDailyGoals = (isExerciseDoneToday ? 1 : 0) + (isCheckinDoneToday ? 1 : 0);
  const isAllGoalsComplete = completedDailyGoals === totalDailyGoals;

  // Sample prompt pills for Knowledge Assistant
  const quickQuestions = [
    'How often should I put ice on my knee?',
    'Is sharp pain during exercise normal?',
    'What are the warning signs of infection?',
    'What should I do if my calf is swollen and tender?',
  ];

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-2">
        <LoadingSkeleton lines={2} />
        <LoadingSkeleton lines={5} />
        <LoadingSkeleton lines={4} />
        <LoadingSkeleton lines={3} />
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="max-w-xl mx-auto py-6">
        <ErrorState message={error} onRetry={loadData} />
      </div>
    );
  }

  // 3. Empty State (No Plan Assigned)
  if (!plan) {
    return (
      <div className="max-w-xl mx-auto py-6 space-y-4">
        <EmptyState
          title="No Active Recovery Plan Found"
          description="Your orthopedic surgical team has not yet published an active recovery protocol for your profile. Please contact your physical therapy clinic or surgical coordinator."
          actionLabel="Refresh & Check Again"
          onAction={loadData}
          icon={<FileText className="w-6 h-6 text-teal-calm" />}
        />
        <Card className="text-center p-4 bg-warm-subtle/50">
          <p className="text-xs text-slate-muted">
            Need immediate clinical assistance? Call your orthopedic nurse line or clinic desk.
          </p>
        </Card>
      </div>
    );
  }

  const daysPostOp = calculateDaysPostOp();
  const protocolProgressPct = calculateProtocolProgress();

  return (
    <div className="space-y-5 max-w-xl mx-auto animate-fadeIn pb-4">
      {/* 1. Header: Patient Welcome & Recovery Context */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-teal-calm tracking-wider uppercase">
              Day {daysPostOp} Post-Operation
            </span>
            <span className="text-slate-subtle">•</span>
            <span className="text-xs font-medium text-slate-muted">
              Right Knee TKA
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-900 tracking-tight mt-0.5">
            Welcome back, {activeProfile.full_name.split(' ')[0]}
          </h1>
          <p className="text-xs sm:text-sm text-slate-muted mt-0.5">
            Here is your personalized recovery protocol for today.
          </p>
        </div>

        <button
          onClick={() => setShowPlanModal(true)}
          className="shrink-0 group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-light text-teal-calm hover:bg-teal-calm hover:text-white transition-all text-xs font-semibold shadow-soft"
          title="View full recovery plan"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>My Plan</span>
        </button>
      </div>

      {/* 2. Recovery Progress Card: Where the Patient Is in Recovery */}
      <Card highlight className="relative overflow-hidden bg-gradient-to-br from-white via-white to-warm-subtle/40 border-teal-calm/30">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-teal-calm uppercase tracking-wider">
                Current Protocol Stage
              </span>
              <Badge variant="teal" size="sm">
                Week 2 Protocol
              </Badge>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-navy-900 mt-0.5">
              {plan.title}
            </h2>
          </div>

          <button
            onClick={() => setShowPlanModal(true)}
            className="text-xs font-semibold text-teal-calm hover:text-teal-hover flex items-center gap-0.5 shrink-0 mt-1"
          >
            <span>Plan Details</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Protocol Timeline Progress Bar */}
        <div className="space-y-1 mb-3">
          <ProgressBar
            value={protocolProgressPct}
            label={`Timeline: Day ${daysPostOp} of 30 Days`}
            sublabel="Phase 1: Early Motion & Swelling Control"
            size="md"
            variant="teal"
            showPercentage={true}
          />
        </div>

        {/* Key Targets & Milestones */}
        <div className="grid grid-cols-2 gap-2 bg-warm-bg/70 p-2.5 rounded-xl border border-warm-border text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-subtle block">
              Clinical Milestone Target
            </span>
            <span className="font-semibold text-navy-900 text-xs">
              0° Extension • 90° Flexion
            </span>
          </div>
          <div className="border-l border-warm-border pl-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-subtle block">
              Care Team Contact
            </span>
            <span className="font-semibold text-navy-900 text-xs">
              Dr. Marcus Patel, DPT
            </span>
          </div>
        </div>
      </Card>

      {/* 3. Relevant Alerts / Clinical Notifications */}
      {activeAlerts.length > 0 && (
        <div className="space-y-2">
          {activeAlerts.map((alt) => (
            <div
              key={alt.id}
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 shadow-soft transition-all ${
                alt.severity === 'urgent' || alt.severity === 'critical'
                  ? 'bg-rose-50/80 border-rose-200 text-status-error'
                  : 'bg-amber-50/80 border-amber-200 text-navy-900'
              }`}
            >
              <AlertCircle
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  alt.severity === 'urgent' || alt.severity === 'critical'
                    ? 'text-status-error'
                    : 'text-amber-600'
                }`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-xs uppercase tracking-wide">
                    {alt.category === 'clinical_review'
                      ? 'Care Team Review Notice'
                      : 'Recovery Adherence Notice'}
                  </span>
                  <Badge
                    variant={alt.severity === 'urgent' ? 'warning' : 'neutral'}
                    size="sm"
                  >
                    {alt.severity.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-xs text-navy-900/90 leading-relaxed">
                  {alt.reason}
                </p>
                <p className="text-[11px] text-slate-muted mt-1">
                  Your physical therapy team has received this record. If symptoms worsen, call your surgical clinic.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Completion State Banner (When all daily goals completed) */}
      {isAllGoalsComplete && (
        <Card className="bg-gradient-to-r from-emerald-500/10 via-teal-calm/10 to-transparent border-emerald-300 py-3.5 px-4 shadow-soft">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-status-success text-white flex items-center justify-center shrink-0 shadow-soft">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-navy-900 text-sm">
                  Today’s Recovery Goals Complete!
                </h3>
                <Badge variant="success" size="sm">
                  100% Done
                </Badge>
              </div>
              <p className="text-xs text-slate-muted mt-0.5 leading-relaxed">
                Great work, {activeProfile.full_name.split(' ')[0]}! You finished your prescribed exercise session and logged today’s check-in. Rest, hydrate, and keep your knee elevated.
              </p>
              <div className="flex items-center gap-3 mt-2 text-[11px] font-medium text-emerald-800">
                <span>✓ Seated knee flexion practice logged</span>
                <span>•</span>
                <span>✓ Symptom check-in saved</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 5. Today's Recovery Plan: What to Do Today */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
              Today’s Recovery Plan
            </h2>
            <p className="text-xs text-slate-muted">
              {completedDailyGoals} of {totalDailyGoals} daily recovery activities completed
            </p>
          </div>
          <Badge
            variant={isAllGoalsComplete ? 'success' : 'teal'}
            size="sm"
          >
            {completedDailyGoals}/{totalDailyGoals} Completed
          </Badge>
        </div>

        {/* Activity 1: Prescribed Exercise Practice */}
        <Card className="hover:border-teal-calm/50 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  isExerciseDoneToday
                    ? 'bg-status-success-bg text-status-success'
                    : 'bg-teal-light text-teal-calm'
                }`}
              >
                {isExerciseDoneToday ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Activity className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-navy-900 text-sm">
                    {primaryExercise?.name || 'Seated Knee Flexion & Extension'}
                  </h3>
                  {isExerciseDoneToday ? (
                    <Badge variant="success" size="sm">
                      Completed Today
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      Pending Today
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-slate-muted mt-1 leading-relaxed line-clamp-2">
                  {primaryExercise?.instructions ||
                    'Sit upright in a chair with feet flat. Slowly slide your foot back under chair to bend knee. Hold 3 seconds, then return.'}
                </p>

                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-subtle">
                  <span className="flex items-center gap-1 font-semibold text-navy-900">
                    <Clock className="w-3.5 h-3.5 text-slate-muted" />
                    Target: {primaryExercise?.target_repetitions || 10} reps (~3 mins)
                  </span>
                  <span>•</span>
                  <span className="text-teal-calm font-medium">Camera Pose Assist</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-warm-border flex items-center justify-between">
            <span className="text-xs text-slate-muted">
              {isExerciseDoneToday
                ? `${todaySessions.length} session${todaySessions.length > 1 ? 's' : ''} logged today (${todaySessions.reduce((acc, s) => acc + s.repetitions, 0)} total reps)`
                : 'Not started yet today'}
            </span>

            <Button
              size="sm"
              variant={isExerciseDoneToday ? 'outline' : 'primary'}
              onClick={() => navigate('/exercise')}
              icon={isExerciseDoneToday ? <RotateCcw className="w-3.5 h-3.5" /> : <Activity className="w-4 h-4" />}
            >
              {isExerciseDoneToday ? 'Practice Again' : 'Start Exercise Practice'}
            </Button>
          </div>
        </Card>

        {/* Activity 2: Daily Symptom Check-in */}
        <Card className="hover:border-teal-calm/50 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  isCheckinDoneToday
                    ? 'bg-status-success-bg text-status-success'
                    : 'bg-warm-subtle text-teal-calm'
                }`}
              >
                {isCheckinDoneToday ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <ClipboardCheck className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-navy-900 text-sm">
                    Daily Symptom Check-in
                  </h3>
                  {isCheckinDoneToday ? (
                    <Badge variant="success" size="sm">
                      Submitted Today
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      Due Today
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-slate-muted mt-1 leading-relaxed">
                  {todayCheckin
                    ? `Reported pain score: ${todayCheckin.pain_score}/10 • Logged at ${new Date(todayCheckin.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                    : 'Record your joint pain, swelling, warmth, and notes for your physical therapist.'}
                </p>

                {todayCheckin && todayCheckin.notes && (
                  <p className="text-[11px] text-slate-muted italic mt-1 bg-warm-subtle p-1.5 rounded-lg border border-warm-border">
                    "{todayCheckin.notes.slice(0, 80)}{todayCheckin.notes.length > 80 ? '...' : ''}"
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-warm-border flex items-center justify-between">
            <span className="text-xs text-slate-muted">
              {isCheckinDoneToday
                ? 'Your care team has received today’s report'
                : 'Takes 1 minute to complete'}
            </span>

            <Button
              size="sm"
              variant={isCheckinDoneToday ? 'outline' : 'primary'}
              onClick={() => navigate('/check-in')}
              icon={isCheckinDoneToday ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ChevronRight className="w-4 h-4" />}
            >
              {isCheckinDoneToday ? 'Review / Update' : 'Log Daily Check-in'}
            </Button>
          </div>
        </Card>

        {/* Activity 3: Prescribed Ice & Elevation Protocol */}
        <Card className="bg-warm-subtle/40 border-warm-border">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4 transform rotate-180" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-navy-900 text-xs sm:text-sm">
                    Ice & Leg Elevation Protocol
                  </h3>
                  <Badge variant="neutral" size="sm">
                    {iceSessionCount}/4 Logged
                  </Badge>
                </div>
                <p className="text-xs text-slate-muted mt-0.5">
                  Apply ice pack wrapped in a light towel for 15–20 minutes with leg elevated above heart.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleLogIce}
              disabled={iceSessionCount >= 4}
              className="text-xs"
            >
              {iceSessionCount >= 4 ? 'All 4 Done' : '+ Log 15m Ice'}
            </Button>
          </div>
        </Card>
      </div>

      {/* 6. Next Check-In Reminder Widget */}
      <Card className="bg-gradient-to-r from-warm-subtle to-white border-warm-border p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-light text-teal-calm flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-subtle tracking-wider block">
                Next Check-In Schedule
              </span>
              <p className="text-xs sm:text-sm font-bold text-navy-900">
                {isCheckinDoneToday
                  ? 'Tomorrow, 9:00 AM'
                  : 'Today before 8:00 PM (Due Now)'}
              </p>
              <p className="text-[11px] text-slate-muted">
                {isCheckinDoneToday
                  ? 'You are up to date for today! We will remind you tomorrow morning.'
                  : 'Submitting daily ensures your physical therapist stays informed.'}
              </p>
            </div>
          </div>

          {!isCheckinDoneToday && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => navigate('/check-in')}
              className="shrink-0"
            >
              Check in Now
            </Button>
          )}
        </div>
      </Card>

      {/* 7. Where to Ask Recovery Questions (Knowledge Assistant Entry) */}
      <Card
        onClick={() => navigate('/assistant')}
        className="cursor-pointer hover:border-teal-calm/60 transition-all group bg-gradient-to-br from-white to-teal-50/20"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-light text-teal-calm flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-navy-900 text-sm">
                  Recovery Knowledge Assistant
                </h3>
                <Badge variant="teal" size="sm">
                  Grounded Guidance
                </Badge>
              </div>
              <p className="text-xs text-slate-muted">
                Answers strictly derived from clinician-approved recovery documents.
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-muted group-hover:text-teal-calm transition-colors shrink-0" />
        </div>

        {/* Clickable Quick Prompts */}
        <div className="pt-2 border-t border-warm-border/60">
          <p className="text-[11px] font-semibold text-slate-subtle mb-1.5 uppercase">
            Suggested Recovery Questions:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {quickQuestions.map((promptText) => (
              <button
                key={promptText}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/assistant?q=${encodeURIComponent(promptText)}`);
                }}
                className="text-left text-[11px] px-2.5 py-1 rounded-full bg-warm-bg border border-warm-border hover:border-teal-calm hover:bg-teal-light/50 text-navy-900 transition-colors"
              >
                "{promptText}"
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* 8. Recent Recovery Activity Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
            Recent Recovery Activity
          </h3>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setActivityTab('all')}
              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold transition-colors ${
                activityTab === 'all'
                  ? 'bg-navy-900 text-white'
                  : 'text-slate-muted hover:text-navy-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActivityTab('exercises')}
              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold transition-colors ${
                activityTab === 'exercises'
                  ? 'bg-navy-900 text-white'
                  : 'text-slate-muted hover:text-navy-900'
              }`}
            >
              Exercises
            </button>
            <button
              onClick={() => setActivityTab('checkins')}
              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold transition-colors ${
                activityTab === 'checkins'
                  ? 'bg-navy-900 text-white'
                  : 'text-slate-muted hover:text-navy-900'
              }`}
            >
              Check-ins
            </button>
          </div>
        </div>

        {/* Activity Items */}
        {recentSessions.length === 0 && recentCheckins.length === 0 ? (
          <Card>
            <p className="text-xs text-slate-muted text-center py-4">
              No exercise sessions or check-ins recorded yet. Complete your first activity above!
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {/* Exercise sessions list */}
            {(activityTab === 'all' || activityTab === 'exercises') &&
              recentSessions.slice(0, 3).map((session) => (
                <Card
                  key={session.id}
                  className="py-2.5 px-3.5 flex items-center justify-between hover:bg-warm-subtle/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-light text-teal-calm flex items-center justify-center font-bold text-xs shrink-0">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-navy-900">
                          {primaryExercise?.name || 'Knee Flexion & Extension'}
                        </p>
                        <Badge
                          variant={session.status === 'completed' ? 'success' : 'neutral'}
                          size="sm"
                        >
                          {session.repetitions} reps
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-subtle">
                        {formatRelativeTimestamp(session.started_at)} • {session.duration_seconds}s
                        {session.measurement_mode === 'camera_prototype' ? ' • Camera assist' : ' • Demo mode'}
                      </p>
                    </div>
                  </div>

                  <Badge variant={session.status === 'completed' ? 'success' : 'neutral'} size="sm">
                    {session.status === 'completed' ? 'Completed' : 'Stopped early'}
                  </Badge>
                </Card>
              ))}

            {/* Check-ins list */}
            {(activityTab === 'all' || activityTab === 'checkins') &&
              recentCheckins.slice(0, 3).map((chk) => (
                <Card
                  key={chk.id}
                  className="py-2.5 px-3.5 flex items-center justify-between hover:bg-warm-subtle/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        chk.pain_score >= 7
                          ? 'bg-rose-100 text-status-error'
                          : 'bg-emerald-100 text-status-success'
                      }`}
                    >
                      <ClipboardCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-navy-900">
                          Symptom Check-in
                        </p>
                        <Badge
                          variant={chk.pain_score >= 7 ? 'warning' : 'success'}
                          size="sm"
                        >
                          Pain: {chk.pain_score}/10
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-subtle">
                        {formatRelativeTimestamp(chk.created_at)}
                        {chk.notes ? ` • "${chk.notes.slice(0, 35)}..."` : ''}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] text-slate-muted">
                    {Object.keys(chk.symptoms).filter((k) => chk.symptoms[k]).length} symptoms noted
                  </span>
                </Card>
              ))}
          </div>
        )}

        <div className="text-center pt-2">
          <button
            onClick={() => navigate('/progress')}
            className="text-xs font-semibold text-teal-calm hover:text-teal-hover inline-flex items-center gap-1"
          >
            <span>View Full Progress Trends & History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 9. Safety & Red-Flag Escalation Notice */}
      <div className="p-3.5 rounded-xl bg-warm-subtle border border-warm-border flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-status-warning shrink-0 mt-0.5" />
        <div className="text-xs text-slate-muted leading-relaxed">
          <strong className="text-navy-900 font-semibold block mb-0.5">
            Post-Op Safety Precaution:
          </strong>
          ReKnee AI provides guidance only and does not diagnose or change prescribed medications. If you experience sudden shortness of breath, chest pain, or severe calf swelling, call 911 or emergency services immediately.
        </div>
      </div>

      {/* 10. "My Recovery Plan" Detail Modal */}
      <Modal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        title="My Recovery Plan & Protocol"
      >
        <div className="space-y-4 text-xs text-navy-900">
          <div>
            <span className="text-[10px] uppercase font-bold text-teal-calm tracking-wider">
              Approved Protocol
            </span>
            <h3 className="text-base font-bold text-navy-900">
              {plan.title}
            </h3>
            <p className="text-slate-muted mt-0.5">
              Prescribed & Approved by: Dr. Marcus Patel, DPT (Orthopedic Rehabilitation Unit)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 bg-warm-subtle p-2.5 rounded-xl border border-warm-border">
            <div>
              <span className="text-[10px] text-slate-subtle uppercase font-semibold block">
                Start Date
              </span>
              <span className="font-bold text-navy-900">
                {plan.start_date || 'Day 1 Post-Op'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-subtle uppercase font-semibold block">
                Target Review Date
              </span>
              <span className="font-bold text-navy-900">
                {plan.end_date || 'Day 30 Post-Op'}
              </span>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-navy-900 uppercase tracking-wider text-[11px] mb-1.5">
              Prescribed Exercises
            </h4>
            <div className="space-y-2">
              {exercises.map((ex, idx) => (
                <div
                  key={ex.id}
                  className="p-2.5 rounded-xl border border-warm-border bg-white space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-navy-900">
                      {idx + 1}. {ex.name}
                    </span>
                    <Badge variant="teal" size="sm">
                      {ex.target_repetitions} Repetitions
                    </Badge>
                  </div>
                  <p className="text-slate-muted text-[11px] leading-relaxed">
                    {ex.instructions}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-bold text-navy-900 uppercase tracking-wider text-[11px] mb-1.5">
              Approved Clinical Precautions
            </h4>
            <ul className="space-y-1.5 list-disc list-inside text-slate-muted text-[11px] leading-relaxed">
              <li>
                <strong className="text-navy-900">Ice & Elevation:</strong> Apply ice wrapped in a light towel for 15-20 min, 3-4 times daily. Keep leg elevated above heart.
              </li>
              <li>
                <strong className="text-navy-900">Movement boundaries:</strong> Mild tightness (pain score up to 3-4/10) is expected. Stop immediately if experiencing sharp distress.
              </li>
              <li>
                <strong className="text-navy-900">Incision care:</strong> Keep clean and dry. Watch for spreading redness beyond 1 inch perimeter or fever ≥ 100.4°F.
              </li>
            </ul>
          </div>

          <div className="pt-2 flex gap-2">
            <Button
              fullWidth
              variant="outline"
              onClick={() => setShowPlanModal(false)}
            >
              Close
            </Button>
            <Button
              fullWidth
              variant="primary"
              onClick={() => {
                setShowPlanModal(false);
                navigate('/exercise');
              }}
              icon={<Activity className="w-4 h-4" />}
            >
              Start Exercise
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
