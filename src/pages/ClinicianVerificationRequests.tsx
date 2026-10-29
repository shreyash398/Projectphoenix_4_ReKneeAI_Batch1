// ReKnee AI - Clinician Verification Requests Screen
// Follows prompt Section 6:
// Shows the recovery activity that the clinician needs to review.
// Clear actions:
// - `Approve & verify`
// - `Request changes`
// - `Download PDF`
// Statuses:
// - Pending review
// - Verified
// - Changes requested
// Keeps explicit review, verification record, and audit trail intact.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  FileText,
  Eye,
  Download,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import {
  RecoveryVerification,
  Profile,
  RecoveryPlan,
  PlanExercise,
  ExerciseSession,
  SymptomCheckin,
} from '../types/database';
import { generateRecoveryCompletionPdf, downloadReportPdf } from '../lib/reports/pdfGenerator';

interface EnrichedVerification {
  verification: RecoveryVerification;
  patient: Profile | null;
  plan: RecoveryPlan | null;
  exercises: PlanExercise[];
  sessions: ExerciseSession[];
  checkins: SymptomCheckin[];
}

export const ClinicianVerificationRequests: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [enrichedList, setEnrichedList] = useState<EnrichedVerification[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'requested' | 'approved' | 'rejected'>('all');

  // Modal Review & Action State
  const [selectedItem, setSelectedItem] = useState<EnrichedVerification | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);

  // Approval Form State
  const [clinicianName, setClinicianName] = useState<string>(activeProfile.full_name || 'Dr. Marcus Patel, DPT');
  const [clinicianDesignation, setClinicianDesignation] = useState<string>('Doctor of Physical Therapy (DPT)');
  const [licenseIdentifier] = useState<string>('PT-CA-84920');
  const [verificationNote, setVerificationNote] = useState<string>('Patient has consistently executed prescribed home mobility exercises with satisfactory progress.');
  const [hasConfirmedReview, setHasConfirmedReview] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Changes / Rejection Form State
  const [rejectReason, setRejectReason] = useState<string>('Please complete at least 2 additional exercise sessions before verification.');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const verifications = await repository.getVerifications();
      const enriched: EnrichedVerification[] = [];

      for (const v of verifications) {
        const [patient, plan, sessions, checkins] = await Promise.all([
          repository.getPatientProfile(v.patient_id),
          repository.getRecoveryPlan(v.patient_id),
          repository.getExerciseSessions(v.patient_id),
          repository.getSymptomCheckins(v.patient_id),
        ]);

        let exercises: PlanExercise[] = [];
        if (plan) {
          exercises = await repository.getPlanExercises(plan.id);
        }

        enriched.push({
          verification: v,
          patient,
          plan,
          exercises,
          sessions,
          checkins,
        });
      }

      setEnrichedList(enriched);
    } catch (err) {
      console.error('Error loading clinician verifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredList = useMemo(() => {
    return enrichedList.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.verification.status === statusFilter;
      const patientName = item.patient?.full_name.toLowerCase() || '';
      const matchesSearch = !searchQuery.trim() || patientName.includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [enrichedList, statusFilter, searchQuery]);

  const handleOpenReview = async (item: EnrichedVerification) => {
    setSelectedItem(item);
    setIsReviewModalOpen(true);
    setActionError(null);
    await repository.recordClinicianOpenedRequest(item.verification.id);
  };

  const handleOpenApprove = (item: EnrichedVerification) => {
    setSelectedItem(item);
    setIsApproveModalOpen(true);
    setHasConfirmedReview(false);
    setActionError(null);
  };

  const handleApproveSubmit = async () => {
    if (!selectedItem) return;
    if (!hasConfirmedReview) {
      setActionError('Please confirm that you have reviewed the recovery activity.');
      return;
    }
    if (!clinicianName.trim() || !clinicianDesignation.trim()) {
      setActionError('Clinician name and professional designation are required.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      await repository.approveVerification({
        verificationId: selectedItem.verification.id,
        clinicianName,
        clinicianDesignation,
        licenseIdentifier,
        verificationNote,
      });

      setIsApproveModalOpen(false);
      setIsReviewModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Approval failed.';
      setActionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedItem) return;
    if (!rejectReason.trim()) {
      setActionError('Please provide change instructions for the patient.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      await repository.rejectVerification({
        verificationId: selectedItem.verification.id,
        reason: rejectReason,
      });

      setIsRejectModalOpen(false);
      setIsReviewModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Requesting changes failed.';
      setActionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = (item: EnrichedVerification) => {
    if (!item.plan || !item.patient) return;
    const report = generateRecoveryCompletionPdf({
      verification: item.verification,
      patient: item.patient,
      clinician: activeProfile,
      plan: item.plan,
      exercises: item.exercises,
      sessions: item.sessions,
      checkins: item.checkins,
    });
    downloadReportPdf(report);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto py-4">
        <LoadingSkeleton lines={2} />
        <LoadingSkeleton lines={4} />
      </div>
    );
  }

  const pendingCount = enrichedList.filter((i) => i.verification.status === 'requested').length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Back button */}
      <button
        onClick={() => navigate('/clinician')}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:text-on-surface hover:border-slate-300 transition-all shadow-sm"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Clinician Overview</span>
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Doctor-Verified Sign-Off Queue</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
            Verification Requests
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review completed patient rehabilitation sessions, ROM achievements, and issue clinical certificates
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search patient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-full border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
            statusFilter === 'all'
              ? 'bg-on-surface text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All Requests ({enrichedList.length})
        </button>
        <button
          onClick={() => setStatusFilter('requested')}
          className={`px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
            statusFilter === 'requested'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:border-amber-300'
          }`}
        >
          Pending Review ({pendingCount})
        </button>
        <button
          onClick={() => setStatusFilter('approved')}
          className={`px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
            statusFilter === 'approved'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:border-primary'
          }`}
        >
          Verified ({enrichedList.filter((i) => i.verification.status === 'approved').length})
        </button>
        <button
          onClick={() => setStatusFilter('rejected')}
          className={`px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
            statusFilter === 'rejected'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:border-rose-300'
          }`}
        >
          Changes Requested ({enrichedList.filter((i) => i.verification.status === 'rejected').length})
        </button>
      </div>

      {/* Requests List */}
      <div className="space-y-3.5">
        {filteredList.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)]">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h2 className="text-sm font-semibold text-on-surface">No verification requests found</h2>
            <p className="text-xs text-slate-400 mt-1">No requests currently match your selected status or search term.</p>
          </div>
        ) : (
          filteredList.map((item) => {
            const v = item.verification;
            const patientName = item.patient?.full_name || 'Patient Chart';
            const completedCount = item.sessions.filter((s) => s.status === 'completed').length;
            const isApproved = v.status === 'approved';
            const isPending = v.status === 'requested';
            const isRejected = v.status === 'rejected';

            return (
              <div
                key={v.id}
                className="p-5 bg-white space-y-3.5 rounded-3xl border border-slate-100 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] hover:shadow-card transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-800 font-bold text-sm flex items-center justify-center shrink-0 border border-slate-200/60 shadow-sm">
                      {patientName.charAt(0)}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm sm:text-base font-bold text-on-surface">{patientName}</h2>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isApproved
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : isPending
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {isApproved ? 'Verified' : isPending ? 'Pending Review' : 'Changes Requested'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        {item.plan?.title || 'Recovery Plan'} • {completedCount} sessions completed
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Requested{' '}
                        {new Date(v.requested_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 sm:self-center">
                    <button
                      onClick={() => handleOpenReview(item)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>Review Activity</span>
                    </button>

                    {isPending && (
                      <>
                        <button
                          onClick={() => handleOpenApprove(item)}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold text-xs shadow-md shadow-primary/20 transition-all active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Verify</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setIsRejectModalOpen(true);
                            setActionError(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-rose-200 bg-rose-50/50 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-all"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Request Changes</span>
                        </button>
                      </>
                    )}

                    {isApproved && (
                      <button
                        onClick={() => handleDownloadPdf(item)}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-900 hover:bg-black text-white font-semibold text-xs shadow-sm transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PDF</span>
                      </button>
                    )}
                  </div>
                </div>

                {isApproved && (
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl text-xs text-emerald-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Verified by {v.clinician_name} ({v.clinician_designation}) on {v.verification_date}</span>
                    </p>
                    {v.verification_note && (
                      <p className="text-slate-600 italic pl-5">"{v.verification_note}"</p>
                    )}
                  </div>
                )}

                {isRejected && (
                  <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-2xl text-xs text-rose-900 space-y-1">
                    <p className="font-bold">Changes requested:</p>
                    <p className="italic">"{v.verification_note}"</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: REVIEW RECOVERY ACTIVITY */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="Review Recovery Activity"
      >
        {selectedItem && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <h3 className="text-xs font-bold text-navy-900">
                {selectedItem.patient?.full_name}
              </h3>
              <p className="text-slate-500 mt-0.5">
                Protocol: <strong>{selectedItem.plan?.title}</strong>
              </p>
            </div>

            {/* Prescribed Exercises */}
            <div>
              <h4 className="font-bold text-navy-900 uppercase text-[11px] mb-1">
                Prescribed Exercises
              </h4>
              <div className="space-y-1">
                {selectedItem.exercises.map((ex) => (
                  <div key={ex.id} className="p-2 rounded-lg border border-slate-200 flex justify-between items-center">
                    <span className="font-medium text-navy-900">{ex.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                      {ex.target_repetitions} reps target
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Completed Sessions */}
            <div>
              <h4 className="font-bold text-navy-900 uppercase text-[11px] mb-1">
                Completed Exercise Sessions ({selectedItem.sessions.length})
              </h4>
              <div className="max-h-36 overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-2 bg-white">
                {selectedItem.sessions.length === 0 ? (
                  <p className="text-slate-400 py-1 text-center">No sessions logged.</p>
                ) : (
                  selectedItem.sessions.map((s) => (
                    <div key={s.id} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-b-0 text-[11px]">
                      <span>{new Date(s.started_at).toLocaleDateString()}</span>
                      <span className="font-medium text-navy-900">{s.repetitions} reps</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        s.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Check-ins */}
            <div>
              <h4 className="font-bold text-navy-900 uppercase text-[11px] mb-1">
                Recent Check-ins ({selectedItem.checkins.length})
              </h4>
              <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-2 bg-white">
                {selectedItem.checkins.length === 0 ? (
                  <p className="text-slate-400 py-1 text-center">No check-ins logged.</p>
                ) : (
                  selectedItem.checkins.map((c) => (
                    <div key={c.id} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-b-0 text-[11px]">
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                      <span className="font-semibold text-rose-600">Pain: {c.pain_score}/10</span>
                      {c.notes && <span className="text-slate-500 truncate max-w-[150px]">"{c.notes}"</span>}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsReviewModalOpen(false)}>
                Close
              </Button>
              {selectedItem.verification.status === 'requested' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-700 hover:text-rose-900 border-rose-200"
                    onClick={() => {
                      setIsReviewModalOpen(false);
                      setIsRejectModalOpen(true);
                    }}
                  >
                    Request changes
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setIsReviewModalOpen(false);
                      setIsApproveModalOpen(true);
                    }}
                  >
                    Approve & verify
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: APPROVE & VERIFY */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title="Approve & Verify Recovery Report"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-600">
            Verifying recovery report for{' '}
            <strong className="text-navy-900">{selectedItem?.patient?.full_name}</strong>.
          </p>

          <div>
            <label className="block text-[11px] font-semibold text-navy-900 mb-1">
              Clinician Name *
            </label>
            <input
              type="text"
              value={clinicianName}
              onChange={(e) => setClinicianName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-navy-900"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-navy-900 mb-1">
              Professional Designation *
            </label>
            <input
              type="text"
              value={clinicianDesignation}
              onChange={(e) => setClinicianDesignation(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-navy-900"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-navy-900 mb-1">
              Clinical Note (Optional)
            </label>
            <textarea
              rows={2}
              value={verificationNote}
              onChange={(e) => setVerificationNote(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-navy-900"
            />
          </div>

          <div className="p-3 bg-teal-light/40 rounded-xl border border-teal-border/60">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasConfirmedReview}
                onChange={(e) => setHasConfirmedReview(e.target.checked)}
                className="mt-0.5 rounded text-teal-calm"
              />
              <span className="text-[11px] font-medium text-navy-900">
                I have reviewed the recovery activity shown in this report.
              </span>
            </label>
          </div>

          {actionError && <p className="text-xs text-rose-600">{actionError}</p>}

          <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsApproveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!hasConfirmedReview || isSubmitting}
              onClick={handleApproveSubmit}
              icon={isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Approve & verify
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: REQUEST CHANGES */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Request Changes"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-600">
            Specify required changes for{' '}
            <strong className="text-navy-900">{selectedItem?.patient?.full_name}</strong>.
          </p>

          <div>
            <label className="block text-[11px] font-semibold text-navy-900 mb-1">
              Instructions *
            </label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-navy-900"
              placeholder="e.g. Complete 2 additional sessions with at least 8 reps..."
            />
          </div>

          {actionError && <p className="text-xs text-rose-600">{actionError}</p>}

          <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isSubmitting || !rejectReason.trim()}
              onClick={handleRejectSubmit}
              className="bg-rose-600 hover:bg-rose-700"
              icon={isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            >
              Request changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClinicianVerificationRequests;
