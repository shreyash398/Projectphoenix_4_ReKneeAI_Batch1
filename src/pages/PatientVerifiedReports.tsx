// ReKnee AI - Patient Verified Reports & Doctor Verification View
// Allows patient to:
// 1. View completion status of assigned recovery protocol
// 2. Request Doctor Verification once required activities are completed
// 3. Track verification status (Pending Review, Approved, Rejected)
// 4. Download approved Doctor-Verified Recovery Activity Report PDF securely
// 5. Strict safety boundaries: No automatic verification claims, disclaimers prominent

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCheck2,
  Clock,
  CheckCircle2,
  XCircle,
  Download,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  FileText,
  Send,
  Sparkles,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import {
  RecoveryVerification,
  RecoveryPlan,
  PlanExercise,
  ExerciseSession,
  SymptomCheckin,
  Profile,
} from '../types/database';
import { generateRecoveryCompletionPdf, downloadReportPdf } from '../lib/reports/pdfGenerator';

export const PatientVerifiedReports: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [sessions, setSessions] = useState<ExerciseSession[]>([]);
  const [checkins, setCheckins] = useState<SymptomCheckin[]>([]);
  const [verifications, setVerifications] = useState<RecoveryVerification[]>([]);
  const [clinician, setClinician] = useState<Profile | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [userPlan, userSessions, userCheckins, userVerifications] = await Promise.all([
        repository.getRecoveryPlan(activeProfile.id),
        repository.getExerciseSessions(activeProfile.id),
        repository.getSymptomCheckins(activeProfile.id),
        repository.getVerifications(activeProfile.id),
      ]);

      setPlan(userPlan);
      setSessions(userSessions);
      setCheckins(userCheckins);
      setVerifications(userVerifications);

      if (userPlan) {
        const exs = await repository.getPlanExercises(userPlan.id);
        setExercises(exs);
        if (userPlan.approved_by) {
          const clin = await repository.getPatientProfile(userPlan.approved_by);
          setClinician(clin);
        }
      }
    } catch (err: unknown) {
      console.error('Error loading verified reports data:', err);
      setErrorMessage('Could not load recovery activity records.');
    } finally {
      setIsLoading(false);
    }
  }, [activeProfile.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Completion calculation
  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === 'completed'),
    [sessions]
  );
  const requiredSessionsThreshold = 5; // Minimum 5 completed sessions to request verification
  const isEligibleForVerification = completedSessions.length >= requiredSessionsThreshold;

  // Active verification request check
  const hasPendingRequest = verifications.some((v) => v.status === 'requested');

  // Request doctor verification action
  const handleRequestVerification = async () => {
    if (!plan) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await repository.requestVerification(activeProfile.id, plan.id);
      setSuccessMessage('Your Doctor Verification request has been submitted to your clinician.');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit verification request.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download PDF Report action
  const handleDownloadPdf = async (v: RecoveryVerification) => {
    if (v.status !== 'approved' || !plan) return;
    setDownloadingId(v.id);
    try {
      // Record download audit trail
      await repository.recordReportDownload(v.id);

      // Generate PDF
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
    } catch (err: unknown) {
      console.error('PDF generation error:', err);
      setErrorMessage('Failed to generate PDF report. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto py-2">
        <LoadingSkeleton lines={2} />
        <LoadingSkeleton lines={4} />
        <LoadingSkeleton lines={4} />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-10">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/progress')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-muted hover:text-navy-900 transition-colors p-1 rounded-lg"
          aria-label="Back to recovery progress"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Recovery Progress</span>
        </button>

        <Badge variant="teal" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
          Verified Records
        </Badge>
      </div>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-navy-900 tracking-tight">
          Doctor-Verified Recovery Reports
        </h1>
        <p className="text-xs sm:text-sm text-slate-muted mt-1">
          Review your completed rehabilitation activity and access clinician-signed recovery reports.
        </p>
      </div>

      {/* Notifications */}
      {successMessage && (
        <Card className="p-3 bg-emerald-50 border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </Card>
      )}

      {errorMessage && (
        <Card className="p-3 bg-rose-50 border-rose-200 text-rose-900 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </Card>
      )}

      {/* Recovery Completion Readiness Card */}
      <Card className="p-4 sm:p-5 border-warm-border bg-white space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-calm">
              Activity Milestone Tracking
            </span>
            <h2 className="text-base font-bold text-navy-900 mt-0.5">
              {plan?.title || 'Active Recovery Protocol'}
            </h2>
            <p className="text-xs text-slate-muted mt-0.5">
              Verification requires completion of prescribed rehabilitation sessions for review by your physical therapy team.
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-light text-teal-calm flex items-center justify-center shrink-0">
            <FileCheck2 className="w-5 h-5" />
          </div>
        </div>

        {/* Readiness Metrics */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-warm-subtle/70 border border-warm-border">
            <p className="text-[10px] text-slate-muted uppercase font-semibold">Completed Sessions</p>
            <p className="text-lg font-bold text-navy-900 mt-0.5">
              {completedSessions.length}{' '}
              <span className="text-xs font-normal text-slate-muted">/ {requiredSessionsThreshold} req.</span>
            </p>
          </div>
          <div className="p-3 rounded-xl bg-warm-subtle/70 border border-warm-border">
            <p className="text-[10px] text-slate-muted uppercase font-semibold">Check-ins Logged</p>
            <p className="text-lg font-bold text-navy-900 mt-0.5">{checkins.length} check-ins</p>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 border-t border-warm-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-muted">
            {hasPendingRequest ? (
              <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
                <Clock className="w-3.5 h-3.5" />
                Request submitted — awaiting clinician review
              </span>
            ) : isEligibleForVerification ? (
              <span className="inline-flex items-center gap-1.5 text-teal-700 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-teal-calm" />
                Activity criteria met for doctor review
              </span>
            ) : (
              <span>
                Complete at least {requiredSessionsThreshold - completedSessions.length} more exercise session(s) to request verification.
              </span>
            )}
          </div>

          <Button
            variant="primary"
            size="sm"
            disabled={!isEligibleForVerification || hasPendingRequest || isSubmitting}
            onClick={handleRequestVerification}
            icon={isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          >
            {hasPendingRequest ? 'Verification Pending' : 'Request Doctor Verification'}
          </Button>
        </div>
      </Card>

      {/* Verified Reports History */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
          Verification Requests & Reports
        </h2>

        {verifications.length === 0 ? (
          <Card className="p-6 text-center bg-white border-warm-border">
            <FileText className="w-8 h-8 text-slate-muted mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-navy-900">No Verification Requests Yet</p>
            <p className="text-xs text-slate-muted mt-1 max-w-sm mx-auto">
              Once you complete your assigned recovery exercises, you can submit a request for your doctor to review and verify your recovery records.
            </p>
          </Card>
        ) : (
          verifications.map((v) => {
            const isApproved = v.status === 'approved';
            const isPending = v.status === 'requested';
            const isRejected = v.status === 'rejected';

            const statusBadgeVariant = isApproved
              ? 'success'
              : isPending
              ? 'warning'
              : 'error';

            const statusLabel = isApproved
              ? 'Approved & Verified'
              : isPending
              ? 'Pending Doctor Review'
              : 'Review Clarification Requested';

            return (
              <Card key={v.id} className="p-4 sm:p-5 bg-white border-warm-border space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-navy-900">
                        Doctor-Verified Recovery Activity Report
                      </h3>
                      <Badge variant={statusBadgeVariant} size="sm">
                        {statusLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-muted mt-1">
                      Verification ID: <span className="font-mono font-medium">{v.verification_id}</span> • Requested:{' '}
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
                      onClick={() => handleDownloadPdf(v)}
                      disabled={downloadingId === v.id}
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

                {/* Approved Clinician Info */}
                {isApproved && (
                  <div className="p-3 bg-teal-light/40 rounded-xl border border-teal-border/50 text-xs space-y-1">
                    <p className="font-semibold text-teal-calm">
                      Verified by {v.clinician_name || 'Authorized Clinician'} ({v.clinician_designation || 'DPT'})
                    </p>
                    <p className="text-slate-muted">
                      Verification Date: {v.verification_date} • Document Reference: {v.document_reference}
                    </p>
                    {v.verification_note && (
                      <p className="text-slate-600 italic mt-1">"{v.verification_note}"</p>
                    )}
                  </div>
                )}

                {/* Rejection / Clarification Info */}
                {isRejected && (
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Clinician Requested Additional Activity / Clarification</span>
                    </div>
                    {v.verification_note && (
                      <p className="text-slate-700 italic mt-0.5">"{v.verification_note}"</p>
                    )}
                  </div>
                )}

                {/* Pending Notice */}
                {isPending && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Your assigned physical therapy team has received this request and is reviewing your exercise records and check-ins.
                    </span>
                  </div>
                )}

                {/* Safety Disclaimer */}
                <p className="text-[10px] text-slate-subtle border-t border-warm-border/60 pt-2">
                  * Important: This report summarizes recorded rehabilitation activity in the ReKnee AI prototype. It does not by itself establish medical fitness, treatment completion, clinical recovery, or medical clearance.
                </p>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
