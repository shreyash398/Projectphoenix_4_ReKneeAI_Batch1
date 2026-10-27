// ReKnee AI - Patient Verified Reports
// Shows verification status and downloads doctor-verified reports.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCheck2,
  Clock,
  CheckCircle2,
  Download,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Send,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge, BadgeVariant } from '../components/common/Badge';
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
      console.error('Error loading verified reports:', err);
      setErrorMessage('Could not load reports.');
    } finally {
      setIsLoading(false);
    }
  }, [activeProfile.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === 'completed'),
    [sessions]
  );
  const requiredSessionsThreshold = 5;
  const isEligibleForVerification = completedSessions.length >= requiredSessionsThreshold;
  const hasPendingRequest = verifications.some((v) => v.status === 'requested');

  const handleRequestVerification = async () => {
    if (!plan) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await repository.requestVerification(activeProfile.id, plan.id);
      setSuccessMessage('Verification request submitted for clinical review.');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit request.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

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
    } catch (err: unknown) {
      console.error('PDF error:', err);
      setErrorMessage('Could not download PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-4">
        <LoadingSkeleton lines={2} />
        <LoadingSkeleton lines={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-12">
      {/* Back button */}
      <button
        onClick={() => navigate('/progress')}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Progress</span>
      </button>

      <div>
        <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Verified Reports</h1>
        <p className="text-xs text-slate-500 mt-1">
          Review your doctor-verified recovery activity reports.
        </p>
      </div>

      {successMessage && (
        <Card className="p-3 bg-teal-light/50 border-teal-border text-xs text-teal-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-calm shrink-0" />
          <span>{successMessage}</span>
        </Card>
      )}

      {errorMessage && (
        <Card className="p-3 bg-rose-50 border-rose-200 text-xs text-rose-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </Card>
      )}

      {/* Verification Request Action if eligible */}
      {!hasPendingRequest && (
        <Card className="p-4 bg-white flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-navy-900">
              {isEligibleForVerification
                ? 'Ready for verification'
                : `Need ${requiredSessionsThreshold - completedSessions.length} more sessions`}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {completedSessions.length} of {requiredSessionsThreshold} completed sessions logged
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            disabled={!isEligibleForVerification || isSubmitting}
            onClick={handleRequestVerification}
            icon={isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          >
            Request verification
          </Button>
        </Card>
      )}

      {/* Reports List */}
      <div className="space-y-3">
        {verifications.length === 0 ? (
          <Card className="p-8 text-center bg-white">
            <FileCheck2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h2 className="text-sm font-semibold text-navy-900">No verification requests yet</h2>
            <p className="text-xs text-slate-400 mt-1">
              Your verified reports will appear here after your doctor reviews your activity.
            </p>
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
                      <h2 className="text-sm font-bold text-navy-900">
                        Recovery Activity Report
                      </h2>
                      <Badge variant={statusBadgeVariant} size="sm">
                        {statusLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Requested on{' '}
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

                {isApproved && (
                  <div className="p-3 bg-teal-light/40 rounded-xl text-xs space-y-1">
                    <p className="font-semibold text-teal-900">
                      Verified by {v.clinician_name || 'Care Team'}
                    </p>
                    {v.verification_note && (
                      <p className="text-slate-600 italic">"{v.verification_note}"</p>
                    )}
                  </div>
                )}

                {isRejected && (
                  <div className="p-3 bg-rose-50 rounded-xl text-xs text-rose-900 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Changes requested</span>
                    </p>
                    {v.verification_note && (
                      <p className="text-slate-700 italic">"{v.verification_note}"</p>
                    )}
                  </div>
                )}

                {isPending && (
                  <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Your care team has received this request and is reviewing your records.</span>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PatientVerifiedReports;
