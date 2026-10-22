// ReKnee AI - Clinician Patient Detail View
// Adheres strictly to 01_PRD.md, 02_DESIGN.md, 04_DATABASE.md, 05_API.md, 11_AUTH_AUTHORIZATION.md, and 14_TESTING_QA.md
// Displays comprehensive clinical recovery records for an authorized patient:
// - Recovery plan & exercises
// - Exercise sessions
// - Symptom check-ins
// - Progress analytics
// - Triggered alerts & audit actions
// - Grounded assistant questions & source citations

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  ClipboardCheck,
  BellRing,
  BookOpen,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  AlertTriangle,
  FileCheck,
  CheckCircle,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge, BadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import {
  Profile,
  RecoveryPlan,
  PlanExercise,
  ExerciseSession,
  SymptomCheckin,
  Alert,
  AssistantQuestion,
  KnowledgeArticle,
} from '../types/database';

type DetailTab = 'overview' | 'sessions' | 'checkins' | 'alerts' | 'assistant';

export const ClinicianPatientDetail: React.FC = () => {
  const { id: patientId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(true);
  const [patient, setPatient] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [sessions, setSessions] = useState<ExerciseSession[]>([]);
  const [checkins, setCheckins] = useState<SymptomCheckin[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [assistantQuestions, setAssistantQuestions] = useState<AssistantQuestion[]>([]);
  const [knowledgeArticles, setKnowledgeArticles] = useState<KnowledgeArticle[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  // Review modal state
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [actionChoice, setActionChoice] = useState<string>('Contacted Patient — Reviewed Symptoms');
  const [actionNotes, setActionNotes] = useState<string>('');
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  useEffect(() => {
    if (!patientId) return;

    const loadData = async () => {
      setIsLoading(true);

      // 1. Authorization check: Clinician must be authorized for this patient
      const authorized = repository.isClinicianAuthorizedForPatient(activeProfile.id, patientId);
      if (!authorized) {
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }
      setIsAuthorized(true);

      try {
        const [
          patientProfile,
          recoveryPlan,
          sessionList,
          checkinList,
          alertList,
          questionsList,
          articles,
        ] = await Promise.all([
          repository.getPatientProfile(patientId),
          repository.getRecoveryPlan(patientId),
          repository.getExerciseSessions(patientId),
          repository.getSymptomCheckins(patientId),
          repository.getAlerts(patientId),
          repository.getAssistantQuestions(patientId),
          repository.getApprovedKnowledgeArticles(),
        ]);

        setPatient(patientProfile);
        setPlan(recoveryPlan);
        setSessions(sessionList);
        setCheckins(checkinList);
        setAlerts(alertList);
        setAssistantQuestions(questionsList);
        setKnowledgeArticles(articles);

        if (recoveryPlan) {
          const exerciseList = await repository.getPlanExercises(recoveryPlan.id);
          setExercises(exerciseList);
        }
      } catch (err) {
        console.error('Failed to load patient records:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [patientId, activeProfile.id]);

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await repository.acknowledgeAlert(
        alertId,
        activeProfile.id,
        'Clinician acknowledged alert directly from Patient Detail chart.'
      );
      if (patientId) {
        const updatedAlerts = await repository.getAlerts(patientId);
        setAlerts(updatedAlerts);
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const handleReviewAction = async () => {
    if (!selectedAlert) return;
    setIsSubmittingAction(true);
    try {
      await repository.reviewAlert(
        selectedAlert.id,
        activeProfile.id,
        actionChoice,
        actionNotes.trim() || 'Reviewed from patient chart.'
      );
      setSelectedAlert(null);
      setActionNotes('');
      if (patientId) {
        const updatedAlerts = await repository.getAlerts(patientId);
        setAlerts(updatedAlerts);
      }
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

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

  // Access Denied Boundary
  if (!isAuthorized) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <Card className="text-center p-8 border-rose-200 bg-rose-50/40">
          <ShieldAlert className="w-12 h-12 text-status-error mx-auto mb-3" />
          <h2 className="text-base font-bold text-navy-900">Access Restricted</h2>
          <p className="text-xs text-slate-muted mt-1 max-w-md mx-auto leading-relaxed">
            You do not have an active clinical authorization to access this patient’s recovery records. Clinicians may only view patients explicitly assigned to their roster.
          </p>
          <div className="mt-4">
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/clinician/patients')}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Authorized Patient Roster
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <LoadingSkeleton lines={2} />
        <LoadingSkeleton lines={4} />
        <LoadingSkeleton lines={4} />
      </div>
    );
  }

  const unreviewedAlerts = alerts.filter((a) => a.status === 'new');
  const avgPainScore =
    checkins.length > 0
      ? (checkins.reduce((acc, c) => acc + c.pain_score, 0) / checkins.length).toFixed(1)
      : 'N/A';
  const totalCompletedSessions = sessions.filter((s) => s.status === 'completed').length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/clinician/patients')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-muted hover:text-navy-900 transition-colors p-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Patient Roster</span>
        </button>

        <Badge variant="teal" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
          Authorized Clinical Relationship
        </Badge>
      </div>

      {/* Patient Profile Banner */}
      <Card className="p-4 sm:p-5 border-warm-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-navy-900 text-white flex items-center justify-center font-bold text-lg shadow-soft shrink-0">
              {patient?.full_name?.charAt(0) || 'P'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-navy-900">
                  {patient?.full_name || 'Patient Chart'}
                </h1>
                <Badge variant="neutral" size="sm">
                  ID: {patientId?.slice(0, 8)}...
                </Badge>
              </div>
              <p className="text-xs text-slate-muted mt-0.5">
                Active Protocol: <strong className="text-teal-calm">{plan?.title || 'Mobility Protocol'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreviewedAlerts.length > 0 ? (
              <Badge variant="error" size="sm" icon={<AlertTriangle className="w-3.5 h-3.5" />}>
                {unreviewedAlerts.length} Unresolved Alert{unreviewedAlerts.length > 1 ? 's' : ''}
              </Badge>
            ) : (
              <Badge variant="success" size="sm" icon={<CheckCircle className="w-3.5 h-3.5" />}>
                No Active Alerts
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Snapshot Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-warm-border/80 text-xs">
          <div className="bg-warm-bg p-2.5 rounded-lg border border-warm-border">
            <span className="text-[10px] text-slate-subtle uppercase font-semibold">Average Pain</span>
            <p className="text-base font-bold text-navy-900 mt-0.5">{avgPainScore} / 10</p>
          </div>

          <div className="bg-warm-bg p-2.5 rounded-lg border border-warm-border">
            <span className="text-[10px] text-slate-subtle uppercase font-semibold">Completed Sessions</span>
            <p className="text-base font-bold text-navy-900 mt-0.5">{totalCompletedSessions}</p>
          </div>

          <div className="bg-warm-bg p-2.5 rounded-lg border border-warm-border">
            <span className="text-[10px] text-slate-subtle uppercase font-semibold">Logged Check-ins</span>
            <p className="text-base font-bold text-navy-900 mt-0.5">{checkins.length}</p>
          </div>

          <div className="bg-warm-bg p-2.5 rounded-lg border border-warm-border">
            <span className="text-[10px] text-slate-subtle uppercase font-semibold">Assistant Inquiries</span>
            <p className="text-base font-bold text-navy-900 mt-0.5">{assistantQuestions.length}</p>
          </div>
        </div>
      </Card>

      {/* Navigation Tabs */}
      <div className="flex gap-1.5 border-b border-warm-border pb-2 text-xs overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-muted hover:bg-warm-subtle'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Recovery Plan</span>
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'sessions'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-muted hover:bg-warm-subtle'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Exercise Sessions ({sessions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('checkins')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'checkins'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-muted hover:bg-warm-subtle'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          <span>Symptom Check-ins ({checkins.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'alerts'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-muted hover:bg-warm-subtle'
          }`}
        >
          <BellRing className="w-3.5 h-3.5" />
          <span>Alerts ({alerts.length})</span>
          {unreviewedAlerts.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-status-error" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('assistant')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'assistant'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-muted hover:bg-warm-subtle'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Assistant Q&A ({assistantQuestions.length})</span>
        </button>
      </div>

      {/* TAB 1: RECOVERY PLAN */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <Card className="p-4 border-warm-border">
            <div className="flex items-center justify-between pb-3 border-b border-warm-border">
              <div>
                <h3 className="text-sm font-bold text-navy-900">{plan?.title || 'Recovery Plan'}</h3>
                <p className="text-xs text-slate-muted mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-teal-calm" />
                  <span>
                    Duration: {plan?.start_date} to {plan?.end_date || 'Ongoing'}
                  </span>
                </p>
              </div>
              <Badge variant="teal" size="sm">
                Status: {plan?.status}
              </Badge>
            </div>

            {/* Prescribed Exercises */}
            <div className="mt-4 space-y-3">
              <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                Assigned Protocol Exercises
              </h4>

              {exercises.length === 0 ? (
                <p className="text-xs text-slate-muted">No exercises assigned to this plan.</p>
              ) : (
                <div className="space-y-2.5">
                  {exercises.map((ex) => (
                    <div
                      key={ex.id}
                      className="bg-warm-bg p-3.5 rounded-xl border border-warm-border text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-navy-900 text-xs sm:text-sm">
                          {ex.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-teal-hover bg-teal-light px-2 py-0.5 rounded-md border border-teal-border">
                            Target: {ex.target_repetitions} reps
                          </span>
                          <span className="text-[11px] font-semibold text-slate-muted bg-white px-2 py-0.5 rounded-md border border-warm-border">
                            {ex.target_duration_seconds}s
                          </span>
                        </div>
                      </div>
                      <p className="text-slate-muted text-xs leading-relaxed">{ex.instructions}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: EXERCISE SESSIONS */}
      {activeTab === 'sessions' && (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <Card className="text-center py-8">
              <Activity className="w-8 h-8 text-slate-subtle mx-auto mb-2" />
              <p className="text-xs text-slate-muted font-medium">No exercise sessions logged yet.</p>
            </Card>
          ) : (
            sessions.map((sess) => (
              <Card key={sess.id} className="p-3.5 border-warm-border text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-warm-border/70">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-teal-calm" />
                    <span className="font-bold text-navy-900">
                      Session — {sess.repetitions} Repetitions
                    </span>
                    <Badge variant={sess.status === 'completed' ? 'success' : 'warning'} size="sm">
                      {sess.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-slate-subtle">
                    {new Date(sess.started_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 pt-1 text-[11px] text-slate-muted">
                  <div>
                    <span className="text-slate-subtle block text-[10px]">Duration:</span>
                    <strong className="text-navy-900">{sess.duration_seconds} seconds</strong>
                  </div>
                  <div>
                    <span className="text-slate-subtle block text-[10px]">Measurement:</span>
                    <span className="font-medium text-teal-hover">{sess.measurement_mode}</span>
                  </div>
                  <div>
                    <span className="text-slate-subtle block text-[10px]">Session Status:</span>
                    <span className="font-medium text-navy-900">{sess.status}</span>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB 3: SYMPTOM CHECK-INS */}
      {activeTab === 'checkins' && (
        <div className="space-y-3">
          {checkins.length === 0 ? (
            <Card className="text-center py-8">
              <ClipboardCheck className="w-8 h-8 text-slate-subtle mx-auto mb-2" />
              <p className="text-xs text-slate-muted font-medium">No symptom check-ins submitted yet.</p>
            </Card>
          ) : (
            checkins.map((chk) => {
              const activeSymptoms = Object.entries(chk.symptoms)
                .filter(([, val]) => val === true)
                .map(([key]) => key.replace(/_/g, ' '));

              return (
                <Card key={chk.id} className="p-3.5 border-warm-border text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-warm-border/70">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          chk.pain_score >= 7
                            ? 'error'
                            : chk.pain_score >= 4
                            ? 'warning'
                            : 'success'
                        }
                        size="sm"
                      >
                        Pain: {chk.pain_score}/10
                      </Badge>
                    </div>
                    <span className="text-[11px] text-slate-subtle">
                      {new Date(chk.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {activeSymptoms.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {activeSymptoms.map((sym, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] bg-warm-bg px-2 py-0.5 rounded-full border border-warm-border text-slate-muted capitalize"
                        >
                          {sym}
                        </span>
                      ))}
                    </div>
                  )}

                  {chk.notes && (
                    <p className="mt-2 text-xs text-navy-900 bg-warm-bg/70 p-2 rounded-lg border border-warm-border/80">
                      "{chk.notes}"
                    </p>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* TAB 4: ALERTS */}
      {activeTab === 'alerts' && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <Card className="text-center py-8">
              <CheckCircle2 className="w-8 h-8 text-status-success mx-auto mb-2" />
              <p className="text-xs text-slate-muted font-medium">No alerts triggered for this patient.</p>
            </Card>
          ) : (
            alerts.map((alt) => (
              <Card
                key={alt.id}
                className={`p-3.5 border text-xs shadow-soft ${
                  alt.status === 'new'
                    ? 'border-l-4 border-l-status-warning bg-amber-50/20'
                    : 'bg-white'
                }`}
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-warm-border/70">
                  <div className="flex items-center gap-2">
                    <Badge variant={getSeverityBadgeVariant(alt.severity)} size="sm">
                      {alt.severity.toUpperCase()}
                    </Badge>
                    <Badge variant={alt.category === 'clinical_review' ? 'error' : 'teal'} size="sm">
                      {alt.category}
                    </Badge>
                  </div>
                  <Badge variant={alt.status === 'new' ? 'warning' : 'success'} size="sm">
                    {alt.status}
                  </Badge>
                </div>

                <p className="font-semibold text-navy-900 text-xs sm:text-sm mb-3">
                  {alt.reason}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-warm-border/80">
                  <span className="text-[10px] text-slate-subtle">
                    {new Date(alt.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  <div className="flex items-center gap-2">
                    {alt.status === 'new' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAcknowledgeAlert(alt.id)}
                        icon={<CheckCircle className="w-3.5 h-3.5" />}
                      >
                        Acknowledge
                      </Button>
                    )}
                    {alt.status !== 'reviewed' && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          setSelectedAlert(alt);
                          setActionNotes('');
                        }}
                        icon={<FileCheck className="w-3.5 h-3.5" />}
                      >
                        Review
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB 5: ASSISTANT INTERACTIONS */}
      {activeTab === 'assistant' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-muted">
            Audit trail of patient inquiries to the Recovery Knowledge Assistant. All answers are strictly grounded in approved guidelines.
          </p>

          {assistantQuestions.length === 0 ? (
            <Card className="text-center py-8">
              <HelpCircle className="w-8 h-8 text-slate-subtle mx-auto mb-2" />
              <p className="text-xs text-slate-muted font-medium">
                No knowledge assistant questions asked yet.
              </p>
            </Card>
          ) : (
            assistantQuestions.map((q) => {
              const citedArticles = knowledgeArticles.filter((art) =>
                q.source_article_ids?.includes(art.id)
              );

              return (
                <Card key={q.id} className="p-3.5 border-warm-border text-xs space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-warm-border/70">
                    <span className="text-[10px] font-bold text-teal-calm uppercase tracking-wide">
                      Patient Question
                    </span>
                    <span className="text-[10px] text-slate-subtle">
                      {new Date(q.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="font-semibold text-navy-900 text-xs">
                    "{q.question}"
                  </p>

                  {q.answer && (
                    <div className="bg-warm-bg p-2.5 rounded-lg border border-warm-border space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-muted uppercase tracking-wider block">
                        Grounded Response
                      </span>
                      <p className="text-slate-muted text-xs leading-relaxed">{q.answer}</p>

                      {citedArticles.length > 0 && (
                        <div className="pt-2 border-t border-warm-border/60">
                          <span className="text-[10px] font-semibold text-navy-900 block mb-1">
                            Cited Clinical Sources:
                          </span>
                          <div className="space-y-1">
                            {citedArticles.map((art) => (
                              <p key={art.id} className="text-[11px] text-teal-hover truncate">
                                • {art.title} ({art.source_label} v{art.version})
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={Boolean(selectedAlert)}
        onClose={() => setSelectedAlert(null)}
        title="Clinician Alert Sign-Off"
      >
        {selectedAlert && (
          <div className="space-y-4 text-xs">
            <div className="p-2.5 rounded-lg bg-warm-bg border border-warm-border">
              <span className="text-[10px] text-slate-subtle uppercase font-semibold block mb-0.5">
                Alert Reason:
              </span>
              <p className="font-semibold text-navy-900">{selectedAlert.reason}</p>
            </div>

            <div>
              <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block mb-1">
                Action Taken
              </label>
              <select
                value={actionChoice}
                onChange={(e) => setActionChoice(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-warm-border bg-white text-navy-900"
              >
                <option value="Contacted Patient — Reviewed Symptoms">
                  Contacted Patient — Reviewed Symptoms
                </option>
                <option value="Telehealth Consultation Scheduled">
                  Telehealth Consultation Scheduled
                </option>
                <option value="Protocol Adjusted">
                  Protocol Adjusted
                </option>
                <option value="Cleared for Continued Protocol">
                  Cleared for Continued Protocol
                </option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block mb-1">
                Clinical Audit Notes
              </label>
              <textarea
                rows={3}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Document clinical rationale or instructions given to patient..."
                className="w-full text-xs p-2.5 rounded-lg border border-warm-border bg-white text-navy-900 resize-none"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <Button variant="outline" fullWidth onClick={() => setSelectedAlert(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                fullWidth
                isLoading={isSubmittingAction}
                onClick={handleReviewAction}
              >
                Sign Off Alert
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
