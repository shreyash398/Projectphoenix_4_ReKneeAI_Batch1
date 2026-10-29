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
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:text-on-surface hover:border-slate-300 transition-all shadow-sm"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Progress</span>
      </button>

      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Clinical Validation</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">Verified Reports</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Review your doctor-verified recovery activity reports and certificates
        </p>
      </div>

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5 shadow-2xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-xs text-rose-900 flex items-center gap-2.5 shadow-2xs font-medium">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Verification Request Action if eligible */}
      {!hasPendingRequest && (
        <div className="rounded-3xl p-5 bg-white border border-slate-100 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-on-surface">
              {isEligibleForVerification
                ? 'Ready for clinical verification'
                : `Need ${requiredSessionsThreshold - completedSessions.length} more sessions`}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {completedSessions.length} of {requiredSessionsThreshold} completed sessions logged
            </p>
          </div>

          <button
            disabled={!isEligibleForVerification || isSubmitting}
            onClick={handleRequestVerification}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all active:scale-95 shadow-md ${
              isEligibleForVerification && !isSubmitting
                ? 'bg-primary hover:bg-primary/90 text-white shadow-primary/20'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            {isSubmitting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Request Verification</span>
          </button>
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-3.5">
        {verifications.length === 0 ? (
          <div className="rounded-3xl p-10 text-center bg-white border border-slate-100 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)]">
            <FileCheck2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h2 className="text-sm font-semibold text-on-surface">No verification requests yet</h2>
            <p className="text-xs text-slate-400 mt-1">
              Your verified reports will appear here after your doctor reviews your activity.
            </p>
          </div>
        ) : (
          verifications.map((v) => {
            const isApproved = v.status === 'approved';
            const isPending = v.status === 'requested';
            const isRejected = v.status === 'rejected';

            const statusLabel = isApproved
              ? 'Verified'
              : isPending
              ? 'Pending Review'
              : 'Changes Requested';

            return (
              <div
                key={v.id}
                className="rounded-3xl p-5 bg-white border border-slate-100 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] hover:shadow-card transition-all space-y-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-on-surface">
                        Recovery Activity Report
                      </h2>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : isPending
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        {statusLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      Requested on{' '}
                      {new Date(v.requested_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>

                  {isApproved && (
                    <button
                      onClick={() => handleDownloadPdf(v)}
                      disabled={downloadingId === v.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 hover:bg-black text-white font-semibold text-xs shadow-sm transition-all"
                    >
                      {downloadingId === v.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>Download PDF</span>
                    </button>
                  )}
                </div>

                {isApproved && (
                  <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-2xl text-xs space-y-1">
                    <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Verified by {v.clinician_name || 'Care Team'}</span>
                    </p>
                    {v.verification_note && (
                      <p className="text-slate-600 italic pl-5">"{v.verification_note}"</p>
                    )}
                  </div>
                )}

                {isRejected && (
                  <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-2xl text-xs text-rose-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Changes requested</span>
                    </p>
                    {v.verification_note && (
                      <p className="text-slate-700 italic pl-5">"{v.verification_note}"</p>
                    )}
                  </div>
                )}

                {isPending && (
                  <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-2xl text-xs text-amber-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Your care team has received this request and is reviewing your records.</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PatientVerifiedReports;
