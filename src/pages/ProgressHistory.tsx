// ReKnee AI - Patient Recovery Progress
// Strictly follows 01_PRD.md and prompt Section 5:
// Three clear sections:
// 1. Exercise activity
// 2. Check-in history
// 3. Verified reports

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  ClipboardList,
  FileCheck2,
  Download,
  RefreshCw,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Card } from '../components/common/Card';
import { Badge, BadgeVariant } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import {
  ExerciseSession,
  SymptomCheckin,
  RecoveryPlan,
  RecoveryVerification,
  PlanExercise,
  Profile,
} from '../types/database';
import { generateRecoveryCompletionPdf, downloadReportPdf } from '../lib/reports/pdfGenerator';

export const ProgressHistory: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ExerciseSession[]>([]);
  const [checkins, setCheckins] = useState<SymptomCheckin[]>([]);
  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [verifications, setVerifications] = useState<RecoveryVerification[]>([]);
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [clinician, setClinician] = useState<Profile | null>(null);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState<boolean>(false);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sessList, chkList, recoveryPlan, userVerifications] = await Promise.all([
        repository.getExerciseSessions(activeProfile.id),
        repository.getSymptomCheckins(activeProfile.id),
        repository.getRecoveryPlan(activeProfile.id),
        repository.getVerifications(activeProfile.id),
      ]);
      setSessions(sessList);
      setCheckins(chkList);
      setPlan(recoveryPlan);
      setVerifications(userVerifications);

      if (recoveryPlan) {
        const exs = await repository.getPlanExercises(recoveryPlan.id);
        setExercises(exs);
        if (recoveryPlan.approved_by) {
          const clin = await repository.getPatientProfile(recoveryPlan.approved_by);
          setClinician(clin);
        }
      }
    } catch (err) {
      console.error('Failed to load progress data:', err);
      setError('Unable to load your recovery progress. Please retry.');
    } finally {
      setIsLoading(false);
    }
  }, [activeProfile.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate metrics
  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === 'completed'),
    [sessions]
  );

  const totalMinutes = useMemo(() => {
    const totalSecs = sessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
    return Math.round(totalSecs / 60);
  }, [sessions]);

  const avgPainScore = useMemo(() => {
    if (checkins.length === 0) return null;
    const sum = checkins.reduce((acc, c) => acc + c.pain_score, 0);
    return (sum / checkins.length).toFixed(1);
  }, [checkins]);

  // Check verification eligibility
  const requiredSessionsThreshold = 5;
  const isEligibleForVerification = completedSessions.length >= requiredSessionsThreshold;
  const hasPendingRequest = verifications.some((v) => v.status === 'requested');

  // Submit verification request
  const handleRequestVerification = async () => {
    if (!plan) return;
    setIsSubmittingVerification(true);
    setVerificationFeedback(null);
    try {
      await repository.requestVerification(activeProfile.id, plan.id);
      setVerificationFeedback('Verification request sent to your care team.');
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to submit request.';
      setVerificationFeedback(msg);
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  // Download PDF Report
  const handleDownloadPdf = async (v: RecoveryVerification) => {
    if (v.status !== 'approved' || !plan) return;
    setDownloadingId(v.id);
    try {
      await repository.recordReportDownload(v.id);
      const pdfReport = generateRecoveryCompletionPdf({
        verification: v,
        patient: activeProfile,
        clinician,
        plan,
        exercises,
        sessions,
        checkins,
      });
      downloadReportPdf(pdfReport);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  // Chart data
  const repsChartData = useMemo(() => {
    if (sessions.length === 0) return [];
    return [...sessions]
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
      .map((s) => {
        const d = new Date(s.started_at);
        return {
          id: s.id,
          dateLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          reps: s.repetitions,
          duration: Math.round((s.duration_seconds || 0) / 60),
        };
      });
  }, [sessions]);

  const painChartData = useMemo(() => {
    if (checkins.length === 0) return [];
    return [...checkins]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((c) => {
        const d = new Date(c.created_at);
        return {
          id: c.id,
          dateLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          pain: c.pain_score,
        };
      });
  }, [checkins]);

  const getPainBadgeVariant = (score: number): BadgeVariant => {
    if (score <= 3) return 'success';
    if (score <= 6) return 'warning';
    return 'error';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-xl mx-auto pb-12">
        <LoadingSkeleton lines={2} />
        <LoadingSkeleton lines={4} />
        <LoadingSkeleton lines={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <ErrorState title="Could Not Load Progress" message={error} onRetry={loadData} />
      </div>
    );
  }

  const hasNoData = sessions.length === 0 && checkins.length === 0;
  if (hasNoData) {
    return (
      <div className="space-y-4 max-w-xl mx-auto pb-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </button>

        <h1 className="text-xl font-bold text-navy-900">Recovery Progress</h1>

        <EmptyState
          title="No recovery activity yet"
          description="Complete your daily exercise session or submit a check-in to start tracking progress."
          actionLabel="Start exercise"
          onAction={() => navigate('/exercise')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Recovery Progress</h1>
        <p className="text-xs text-slate-500 mt-1">
          Review your exercise sessions, check-in history, and verified reports.
        </p>
      </div>

      {verificationFeedback && (
        <Card className="p-3 bg-teal-light/50 border-teal-border text-xs text-teal-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-calm shrink-0" />
          <span>{verificationFeedback}</span>
        </Card>
      )}

      {/* ─── 1. Exercise Activity ─────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-calm" />
            <h2 className="text-base font-bold text-navy-900">Exercise activity</h2>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {completedSessions.length} sessions completed ({totalMinutes}m total)
          </span>
        </div>

        {/* Repetitions Chart */}
        {repsChartData.length > 0 && (
          <Card className="p-4 bg-white space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-navy-900">Repetitions per session</span>
              <span>Target: 10 reps</span>
            </div>
            <div className="h-36 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={repsChartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1EDE6" vertical={false} />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#8C98A9' }} tickLine={false} />
                  <YAxis allowDecimals={false} domain={[0, 'dataMax + 2']} tick={{ fontSize: 10, fill: '#8C98A9' }} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-navy-950 text-white p-2 rounded-lg text-xs shadow-md">
                            <p className="font-semibold">{data.dateLabel}</p>
                            <p className="text-teal-300 font-bold">{data.reps} repetitions</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="reps" fill="#0D9488" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Sessions List */}
        <div className="space-y-2">
          {sessions.slice(0, 5).map((sess) => {
            const isCompleted = sess.status === 'completed';
            return (
              <Card key={sess.id} className="p-3 bg-white flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-navy-900">Seated Knee Flexion & Extension</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(sess.started_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    • {formatDuration(sess.duration_seconds)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-navy-900">{sess.repetitions} reps</span>
                  <Badge variant={isCompleted ? 'success' : 'warning'} size="sm">
                    {isCompleted ? 'Completed' : 'Stopped early'}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ─── 2. Check-in History ─────────────────────────────────────── */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-teal-calm" />
            <h2 className="text-base font-bold text-navy-900">Check-in history</h2>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {avgPainScore !== null ? `Average pain: ${avgPainScore}/10` : `${checkins.length} check-ins`}
          </span>
        </div>

        {/* Pain Chart */}
        {painChartData.length > 0 && (
          <Card className="p-4 bg-white space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-navy-900">Pain level (0–10)</span>
              <span>Lower score is better</span>
            </div>
            <div className="h-36 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={painChartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1EDE6" vertical={false} />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#8C98A9' }} tickLine={false} />
                  <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 10, fill: '#8C98A9' }} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-navy-950 text-white p-2 rounded-lg text-xs shadow-md">
                            <p className="font-semibold">{data.dateLabel}</p>
                            <p className="text-rose-400 font-bold">Pain: {data.pain} / 10</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pain"
                    stroke="#E11D48"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#E11D48' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Check-ins List */}
        <div className="space-y-2">
          {checkins.length === 0 ? (
            <Card className="p-3 text-center text-xs text-slate-400">No check-ins submitted yet.</Card>
          ) : (
            checkins.slice(0, 5).map((chk) => {
              const symptomObj = (chk.symptoms || {}) as Record<string, boolean>;
              const symptoms = Object.entries(symptomObj)
                .filter(([_, val]) => Boolean(val))
                .map(([key]) => key.replace(/_/g, ' '));

              return (
                <Card key={chk.id} className="p-3 bg-white space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      {new Date(chk.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <Badge variant={getPainBadgeVariant(chk.pain_score)} size="sm">
                      Pain: {chk.pain_score} / 10
                    </Badge>
                  </div>

                  {symptoms.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {symptoms.map((s) => (
                        <span key={s} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {chk.notes && (
                    <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg">
                      "{chk.notes}"
                    </p>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </section>

      {/* ─── 3. Verified Reports ──────────────────────────────────────── */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-teal-calm" />
            <h2 className="text-base font-bold text-navy-900">Verified reports</h2>
          </div>
          {isEligibleForVerification && !hasPendingRequest && (
            <Button
              variant="outline"
              size="sm"
              disabled={isSubmittingVerification}
              onClick={handleRequestVerification}
              icon={isSubmittingVerification ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            >
              Request verification
            </Button>
          )}
        </div>

        {verifications.length === 0 ? (
          <Card className="p-4 text-center bg-white space-y-2">
            <p className="text-xs text-slate-500">
              {isEligibleForVerification
                ? 'You have completed enough sessions to request a verified report from your care team.'
                : `Complete ${requiredSessionsThreshold - completedSessions.length} more exercise session(s) to request verification.`}
            </p>
            {isEligibleForVerification && !hasPendingRequest && (
              <Button
                variant="primary"
                size="sm"
                disabled={isSubmittingVerification}
                onClick={handleRequestVerification}
                icon={<Send className="w-3.5 h-3.5" />}
              >
                Request verification
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-2">
            {verifications.map((v) => {
              const isApproved = v.status === 'approved';
              const isPending = v.status === 'requested';
              const isRejected = v.status === 'rejected';

              const statusBadgeVariant: BadgeVariant = isApproved
                ? 'success'
                : isPending
                ? 'warning'
                : 'error';

              const statusLabel = isApproved
                ? 'Verified'
                : isPending
                ? 'Pending review'
                : 'Changes requested';

              return (
                <Card key={v.id} className="p-4 bg-white space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-navy-900">
                          Recovery Activity Report
                        </h3>
                        <Badge variant={statusBadgeVariant} size="sm">
                          {statusLabel}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Requested{' '}
                        {new Date(v.requested_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>

                    {isApproved && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={downloadingId === v.id}
                        onClick={() => handleDownloadPdf(v)}
                        icon={
                          downloadingId === v.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )
                        }
                      >
                        Download PDF
                      </Button>
                    )}
                  </div>

                  {isApproved && (
                    <div className="p-2.5 bg-teal-light/40 rounded-xl text-xs text-teal-900 space-y-0.5">
                      <p className="font-semibold">
                        Verified by {v.clinician_name || 'Care Team'}
                      </p>
                      {v.verification_note && (
                        <p className="text-slate-600 italic">"{v.verification_note}"</p>
                      )}
                    </div>
                  )}

                  {isRejected && (
                    <div className="p-2.5 bg-rose-50 rounded-xl text-xs text-rose-900 space-y-0.5">
                      <p className="font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Changes requested by clinician</span>
                      </p>
                      {v.verification_note && (
                        <p className="text-slate-700 italic">"{v.verification_note}"</p>
                      )}
                    </div>
                  )}

                  {isPending && (
                    <p className="text-xs text-amber-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Pending clinician review.</span>
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default ProgressHistory;
