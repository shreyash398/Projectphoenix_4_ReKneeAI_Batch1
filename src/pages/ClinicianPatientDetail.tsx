// ReKnee AI - Clinician Patient Detail View
// Follows prompt Section 6:
// Grouped into:
// 1. Recovery plan
// 2. Exercise activity
// 3. Check-ins
// 4. Alerts
// 5. Verification

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  ClipboardList,
  AlertTriangle,
  FileCheck2,
  BookOpen,
  CheckCircle,
  Clock,
  ShieldAlert,
  Download,
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
  RecoveryVerification,
} from '../types/database';
import { generateRecoveryCompletionPdf, downloadReportPdf } from '../lib/reports/pdfGenerator';

type PatientSection = 'plan' | 'exercises' | 'checkins' | 'alerts' | 'verification';

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
  const [verifications, setVerifications] = useState<RecoveryVerification[]>([]);
  const [activeSection, setActiveSection] = useState<PatientSection>('plan');

  // Review modal state
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [actionChoice, setActionChoice] = useState<string>('Contacted Patient — Reviewed Symptoms');
  const [actionNotes, setActionNotes] = useState<string>('');
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!patientId) return;
    setIsLoading(true);

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
        verificationList,
      ] = await Promise.all([
        repository.getPatientProfile(patientId),
        repository.getRecoveryPlan(patientId),
        repository.getExerciseSessions(patientId),
        repository.getSymptomCheckins(patientId),
        repository.getAlerts(patientId),
        repository.getVerifications(patientId),
      ]);

      setPatient(patientProfile);
      setPlan(recoveryPlan);
      setSessions(sessionList);
      setCheckins(checkinList);
      setAlerts(alertList);
      setVerifications(verificationList);

      if (recoveryPlan) {
        const exerciseList = await repository.getPlanExercises(recoveryPlan.id);
        setExercises(exerciseList);
      }
    } catch (err) {
      console.error('Failed to load patient records:', err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, activeProfile.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await repository.acknowledgeAlert(
        alertId,
        activeProfile.id,
        'Clinician acknowledged alert.'
      );
      await loadData();
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
      await loadData();
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleDownloadPdf = (v: RecoveryVerification) => {
    if (!plan || !patient) return;
    const report = generateRecoveryCompletionPdf({
      verification: v,
      patient,
      clinician: activeProfile,
      plan,
      exercises,
      sessions,
      checkins,
    });
    downloadReportPdf(report);
  };

  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === 'completed'),
    [sessions]
  );

  const avgPainScore = useMemo(() => {
    if (checkins.length === 0) return null;
    const sum = checkins.reduce((acc, c) => acc + c.pain_score, 0);
    return (sum / checkins.length).toFixed(1);
  }, [checkins]);

  const unreviewedAlerts = alerts.filter(
    (a) => a.status === 'new' || a.status === 'acknowledged'
  );

  if (!isAuthorized) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <Card className="text-center p-6 border-rose-200 bg-rose-50/40 space-y-3">
          <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto" />
          <h2 className="text-base font-bold text-navy-900">Access Restricted</h2>
          <p className="text-xs text-slate-600">
            You do not have authorization to view this patient chart.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/clinician/patients')}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Back to Patients
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto py-4">
        <LoadingSkeleton lines={2} />
        <LoadingSkeleton lines={4} />
        <LoadingSkeleton lines={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Top navigation */}
      <button
        onClick={() => navigate('/clinician/patients')}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Patients</span>
      </button>

      {/* Patient Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-navy-900 text-white flex items-center justify-center font-bold text-base shrink-0">
            {patient?.full_name?.charAt(0) || 'P'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-navy-900">{patient?.full_name || 'Patient Chart'}</h1>
              {unreviewedAlerts.length > 0 ? (
                <Badge variant="error" size="sm">
                  {unreviewedAlerts.length} alert{unreviewedAlerts.length > 1 ? 's' : ''}
                </Badge>
              ) : (
                <Badge variant="success" size="sm">
                  On track
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Protocol: <span className="text-navy-900 font-semibold">{plan?.title || 'Recovery Plan'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{completedSessions.length} completed sessions</span>
          <span>•</span>
          <span>Avg pain: {avgPainScore ? `${avgPainScore}/10` : 'None'}</span>
        </div>
      </div>

      {/* 5 Section Tabs */}
      <div className="flex gap-1.5 border-b border-slate-200 pb-2 text-xs overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSection('plan')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
            activeSection === 'plan'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Recovery plan</span>
        </button>

        <button
          onClick={() => setActiveSection('exercises')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
            activeSection === 'exercises'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Exercise activity ({sessions.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('checkins')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
            activeSection === 'checkins'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>Check-ins ({checkins.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('alerts')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
            activeSection === 'alerts'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Alerts ({alerts.length})</span>
          {unreviewedAlerts.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-600" />
          )}
        </button>

        <button
          onClick={() => setActiveSection('verification')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
            activeSection === 'verification'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          <span>Verification ({verifications.length})</span>
        </button>
      </div>

      {/* ─── SECTION 1: Recovery Plan ─────────────────────────────────── */}
      {activeSection === 'plan' && (
        <div className="space-y-4">
          <Card className="p-4 bg-white space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-sm font-bold text-navy-900">{plan?.title || 'Prescribed Protocol'}</h2>
              <Badge variant="teal" size="sm">Active</Badge>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Prescribed post-operative rehabilitation protocol with daily flexion and extension targets.
            </p>
            <p className="text-[11px] text-slate-400">
              Started: {plan?.start_date || 'N/A'} • End: {plan?.end_date || 'N/A'}
            </p>
          </Card>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Prescribed Exercises ({exercises.length})
            </h3>
            {exercises.map((ex) => (
              <Card key={ex.id} className="p-3 bg-white flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-navy-900">{ex.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{ex.instructions}</p>
                </div>
                <Badge variant="neutral" size="sm">
                  Target: {ex.target_repetitions} reps
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ─── SECTION 2: Exercise Activity ─────────────────────────────── */}
      {activeSection === 'exercises' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Completed Exercise Sessions
            </h2>
            <span className="text-xs text-slate-500">
              {completedSessions.length} completed of {sessions.length} recorded
            </span>
          </div>

          {sessions.length === 0 ? (
            <Card className="p-6 text-center text-xs text-slate-400 bg-white">
              No exercise sessions recorded yet.
            </Card>
          ) : (
            sessions.map((s) => (
              <Card key={s.id} className="p-3 bg-white flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-navy-900">Seated Knee Flexion & Extension</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(s.started_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    • {Math.round(s.duration_seconds / 60)}m
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-navy-900">{s.repetitions} reps</span>
                  <Badge variant={s.status === 'completed' ? 'success' : 'warning'} size="sm">
                    {s.status === 'completed' ? 'Completed' : 'Stopped early'}
                  </Badge>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ─── SECTION 3: Check-ins ─────────────────────────────────────── */}
      {activeSection === 'checkins' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Patient Check-ins ({checkins.length})
            </h2>
            <span className="text-xs text-slate-500">
              {avgPainScore ? `Average pain: ${avgPainScore}/10` : 'No logs'}
            </span>
          </div>

          {checkins.length === 0 ? (
            <Card className="p-6 text-center text-xs text-slate-400 bg-white">
              No check-ins submitted yet.
            </Card>
          ) : (
            checkins.map((chk) => {
              const symptoms = Object.entries((chk.symptoms || {}) as Record<string, boolean>)
                .filter(([_, val]) => Boolean(val))
                .map(([key]) => key.replace(/_/g, ' '));

              return (
                <Card key={chk.id} className="p-3 bg-white space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      {new Date(chk.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <Badge variant={chk.pain_score >= 8 ? 'error' : chk.pain_score >= 5 ? 'warning' : 'success'} size="sm">
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
      )}

      {/* ─── SECTION 4: Alerts ────────────────────────────────────────── */}
      {activeSection === 'alerts' && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Clinical Alerts ({alerts.length})
          </h2>

          {alerts.length === 0 ? (
            <Card className="p-6 text-center text-xs text-slate-400 bg-white">
              No alerts generated for this patient.
            </Card>
          ) : (
            alerts.map((alert) => (
              <Card
                key={alert.id}
                className={`p-4 bg-white shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 ${
                  alert.category === 'clinical_review'
                    ? 'border-l-rose-500'
                    : 'border-l-teal-calm'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={alert.category === 'clinical_review' ? 'error' : 'teal'} size="sm">
                      {alert.category === 'clinical_review' ? 'Clinical Review' : 'Reminder'}
                    </Badge>
                    <Badge variant={alert.status === 'new' ? 'warning' : 'neutral'} size="sm">
                      {alert.status}
                    </Badge>
                  </div>
                  <p className="text-xs font-semibold text-navy-900">{alert.reason}</p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(alert.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {alert.status === 'new' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAcknowledgeAlert(alert.id)}
                      icon={<CheckCircle className="w-3.5 h-3.5" />}
                    >
                      Acknowledge
                    </Button>
                  )}
                  {alert.status !== 'reviewed' && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setSelectedAlert(alert);
                        setActionNotes('');
                      }}
                    >
                      Review alert
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ─── SECTION 5: Verification ──────────────────────────────────── */}
      {activeSection === 'verification' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Verification Status
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/clinician/verifications')}
              icon={<FileCheck2 className="w-3.5 h-3.5" />}
            >
              Verification Requests Queue
            </Button>
          </div>

          {verifications.length === 0 ? (
            <Card className="p-6 text-center text-xs text-slate-400 bg-white">
              No verification requests submitted for this patient yet.
            </Card>
          ) : (
            verifications.map((v) => {
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
                <Card key={v.id} className="p-4 bg-white space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-navy-900">
                          Recovery Activity Report
                        </h3>
                        <Badge variant={statusBadgeVariant} size="sm">
                          {statusLabel}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Requested: {new Date(v.requested_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isPending && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => navigate('/clinician/verifications')}
                        >
                          Review verification
                        </Button>
                      )}
                      {isApproved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadPdf(v)}
                          icon={<Download className="w-3.5 h-3.5" />}
                        >
                          Download PDF
                        </Button>
                      )}
                    </div>
                  </div>

                  {isApproved && (
                    <div className="p-3 bg-teal-light/40 rounded-xl text-xs space-y-1">
                      <p className="font-semibold text-teal-900">
                        Verified by {v.clinician_name || 'Clinician'} on {v.verification_date}
                      </p>
                      {v.verification_note && (
                        <p className="text-slate-600 italic">"{v.verification_note}"</p>
                      )}
                    </div>
                  )}

                  {isRejected && (
                    <div className="p-3 bg-rose-50 rounded-xl text-xs text-rose-900 space-y-1">
                      <p className="font-semibold">Changes requested:</p>
                      <p className="italic">"{v.verification_note}"</p>
                    </div>
                  )}

                  {isPending && (
                    <p className="text-xs text-amber-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Awaiting clinical verification sign-off.</span>
                    </p>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Review Alert Modal */}
      <Modal
        isOpen={Boolean(selectedAlert)}
        onClose={() => setSelectedAlert(null)}
        title="Review Alert"
      >
        {selectedAlert && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">Alert Reason</span>
              <p className="text-xs font-semibold text-navy-900 mt-0.5">{selectedAlert.reason}</p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-navy-900 mb-1">
                Clinical Action Taken
              </label>
              <select
                value={actionChoice}
                onChange={(e) => setActionChoice(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value="Contacted Patient — Reviewed Symptoms">
                  Contacted Patient — Reviewed Symptoms
                </option>
                <option value="Adjusted Exercise Repetition Target">
                  Adjusted Exercise Repetition Target
                </option>
                <option value="Scheduled Follow-up Clinic Consultation">
                  Scheduled Follow-up Clinic Consultation
                </option>
                <option value="Clinically Assessed — Routine Fluctuation">
                  Clinically Assessed — Routine Fluctuation
                </option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-navy-900 mb-1">
                Review Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Enter clinical review notes..."
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedAlert(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={isSubmittingAction}
                onClick={handleReviewAction}
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Sign off review
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ClinicianPatientDetail;
