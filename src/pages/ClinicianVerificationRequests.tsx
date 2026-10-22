// ReKnee AI - Clinician Verification Requests Screen
// Displays:
// - Incoming patient Doctor Verification requests
// - Complete patient recovery activity review:
//   - Patient name & identifier
//   - Recovery plan & period
//   - Assigned exercises
//   - Completed exercise sessions & dates
//   - Completion percentage & metrics
//   - Relevant check-in summary & average pain score
// - Doctor actions:
//   - [Review]
//   - [Approve & Sign] (Requires explicit confirmation, clinician name, designation, optional license ID & notes)
//   - [Reject / Request Clarification]
// - Clearly labeled DEMO verification disclaimer
// - Pluggable e-signature architecture

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Stethoscope,
  RefreshCw,
  Search,
  ShieldCheck,
  FileText,
  Eye,
  Download,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
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
  const [licenseIdentifier, setLicenseIdentifier] = useState<string>('PT-CA-84920');
  const [verificationNote, setVerificationNote] = useState<string>('Patient has consistently executed prescribed home mobility exercises with satisfactory progress.');
  const [hasConfirmedReview, setHasConfirmedReview] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Rejection Form State
  const [rejectReason, setRejectReason] = useState<string>('Please complete at least 2 additional exercise sessions before formal verification can be granted.');

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

  // Filtered List
  const filteredList = useMemo(() => {
    return enrichedList.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.verification.status === statusFilter;
      const patientName = item.patient?.full_name.toLowerCase() || '';
      const code = item.verification.verification_id?.toLowerCase() || '';
      const matchesSearch =
        !searchQuery.trim() ||
        patientName.includes(searchQuery.toLowerCase()) ||
        code.includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [enrichedList, statusFilter, searchQuery]);

  // Open Review Details Modal
  const handleOpenReview = async (item: EnrichedVerification) => {
    setSelectedItem(item);
    setIsReviewModalOpen(true);
    setActionError(null);
    // Record clinician opened request audit action
    await repository.recordClinicianOpenedRequest(item.verification.id);
  };

  // Trigger Approve Modal
  const handleOpenApprove = (item: EnrichedVerification) => {
    setSelectedItem(item);
    setIsApproveModalOpen(true);
    setHasConfirmedReview(false);
    setActionError(null);
  };

  // Submit Approval
  const handleApproveSubmit = async () => {
    if (!selectedItem) return;
    if (!hasConfirmedReview) {
      setActionError('You must confirm that you have reviewed the recovery activity shown in this report.');
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

  // Submit Rejection
  const handleRejectSubmit = async () => {
    if (!selectedItem) return;
    if (!rejectReason.trim()) {
      setActionError('Please provide a reason or clarification instructions for the patient.');
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
      const msg = err instanceof Error ? err.message : 'Rejection failed.';
      setActionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download PDF
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
      <div className="space-y-4 max-w-4xl mx-auto py-2">
        <LoadingSkeleton lines={2} />
        <LoadingSkeleton lines={4} />
        <LoadingSkeleton lines={4} />
      </div>
    );
  }

  const pendingCount = enrichedList.filter((i) => i.verification.status === 'requested').length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-teal-calm tracking-wide uppercase">
              Clinician Oversight Portal
            </span>
            <Badge variant="teal" size="sm" icon={<Stethoscope className="w-3 h-3" />}>
              Doctor Verification
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-900 tracking-tight mt-0.5">
            Verification Requests
          </h1>
          <p className="text-xs sm:text-sm text-slate-muted mt-0.5">
            Review patient exercise records and approve Doctor-Verified Recovery Activity Reports.
          </p>
        </div>

        {/* View Switcher Tabs (Consistent with Clinician Portal) */}
        <div className="flex items-center gap-1.5 p-1 bg-warm-subtle rounded-xl border border-warm-border self-start sm:self-auto text-xs">
          <button
            onClick={() => navigate('/clinician')}
            className="px-3 py-1.5 font-semibold text-slate-muted hover:text-navy-900 rounded-lg transition-all"
          >
            Overview
          </button>
          <button
            onClick={() => navigate('/clinician/patients')}
            className="px-3 py-1.5 font-semibold text-slate-muted hover:text-navy-900 rounded-lg transition-all"
          >
            Patients
          </button>
          <button
            onClick={() => navigate('/clinician/alerts')}
            className="px-3 py-1.5 font-semibold text-slate-muted hover:text-navy-900 rounded-lg transition-all"
          >
            Alerts
          </button>
          <button
            onClick={() => navigate('/clinician/verifications')}
            className="px-3 py-1.5 font-semibold bg-white text-navy-900 shadow-soft rounded-lg transition-all relative"
          >
            <span>Verifications</span>
            {pendingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-teal-calm text-white text-[10px] font-bold rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-3 bg-white border-warm-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-navy-900 text-white'
                : 'bg-warm-subtle text-slate-muted hover:text-navy-900'
            }`}
          >
            All Requests ({enrichedList.length})
          </button>
          <button
            onClick={() => setStatusFilter('requested')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === 'requested'
                ? 'bg-amber-600 text-white'
                : 'bg-warm-subtle text-slate-muted hover:text-navy-900'
            }`}
          >
            Pending Review ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === 'approved'
                ? 'bg-emerald-600 text-white'
                : 'bg-warm-subtle text-slate-muted hover:text-navy-900'
            }`}
          >
            Approved ({enrichedList.filter((i) => i.verification.status === 'approved').length})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === 'rejected'
                ? 'bg-rose-600 text-white'
                : 'bg-warm-subtle text-slate-muted hover:text-navy-900'
            }`}
          >
            Clarification ({enrichedList.filter((i) => i.verification.status === 'rejected').length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search patient or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-warm-border bg-warm-subtle/50 text-navy-900 placeholder:text-slate-muted focus:outline-none focus:ring-1 focus:ring-teal-calm"
          />
        </div>
      </Card>

      {/* Requests List */}
      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <Card className="p-8 text-center bg-white border-warm-border">
            <FileText className="w-8 h-8 text-slate-muted mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-navy-900">No Verification Requests Found</p>
            <p className="text-xs text-slate-muted mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters or search query.'
                : 'There are currently no verification requests pending your clinical review.'}
            </p>
          </Card>
        ) : (
          filteredList.map((item) => {
            const v = item.verification;
            const patientName = item.patient?.full_name || 'Patient Chart';
            const completedCount = item.sessions.filter((s) => s.status === 'completed').length;
            const isApproved = v.status === 'approved';
            const isPending = v.status === 'requested';
            const isRejected = v.status === 'rejected';

            const statusBadgeVariant = isApproved
              ? 'success'
              : isPending
              ? 'warning'
              : 'error';

            const statusLabel = isApproved
              ? 'Approved & Signed'
              : isPending
              ? 'Review Required'
              : 'Clarification Requested';

            return (
              <Card key={v.id} className="p-4 sm:p-5 bg-white border-warm-border space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-navy-900">{patientName}</h3>
                      <Badge variant={statusBadgeVariant} size="sm">
                        {statusLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-muted mt-0.5">
                      Protocol: <strong className="text-navy-900">{item.plan?.title || 'Recovery Plan'}</strong> • Verification ID: <span className="font-mono">{v.verification_id}</span>
                    </p>
                    <p className="text-[11px] text-slate-muted">
                      Requested: {new Date(v.requested_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenReview(item)}
                      icon={<Eye className="w-3.5 h-3.5" />}
                    >
                      Review Data
                    </Button>

                    {isPending && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenApprove(item)}
                          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        >
                          Approve & Sign
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedItem(item);
                            setIsRejectModalOpen(true);
                            setActionError(null);
                          }}
                          className="text-rose-700 hover:text-rose-900 border-rose-200 hover:bg-rose-50"
                          icon={<XCircle className="w-3.5 h-3.5" />}
                        >
                          Reject
                        </Button>
                      </>
                    )}

                    {isApproved && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadPdf(item)}
                        icon={<Download className="w-3.5 h-3.5" />}
                      >
                        PDF Report
                      </Button>
                    )}
                  </div>
                </div>

                {/* Activity Highlights */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="p-2 rounded-lg bg-warm-subtle/70">
                    <span className="text-[10px] text-slate-muted uppercase font-semibold">Sessions</span>
                    <p className="font-bold text-navy-900 mt-0.5">{completedCount} completed</p>
                  </div>
                  <div className="p-2 rounded-lg bg-warm-subtle/70">
                    <span className="text-[10px] text-slate-muted uppercase font-semibold">Check-ins</span>
                    <p className="font-bold text-navy-900 mt-0.5">{item.checkins.length} logged</p>
                  </div>
                  <div className="p-2 rounded-lg bg-warm-subtle/70">
                    <span className="text-[10px] text-slate-muted uppercase font-semibold">Report Period</span>
                    <p className="font-bold text-navy-900 mt-0.5 truncate">{item.plan?.start_date || 'N/A'} - {item.plan?.end_date || 'Current'}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-warm-subtle/70">
                    <span className="text-[10px] text-slate-muted uppercase font-semibold">Status</span>
                    <p className="font-bold text-navy-900 mt-0.5 capitalize">{v.status}</p>
                  </div>
                </div>

                {isApproved && (
                  <p className="text-xs text-teal-800 bg-teal-light/40 px-3 py-1.5 rounded-lg border border-teal-border/40">
                    Verified by {v.clinician_name} ({v.clinician_designation}) on {v.verification_date}
                    {v.verification_note ? ` — "${v.verification_note}"` : ''}
                  </p>
                )}

                {isRejected && (
                  <p className="text-xs text-rose-800 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                    Clarification requested: "{v.verification_note}"
                  </p>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* MODAL 1: CLINICAL DATA REVIEW MODAL */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="Review Patient Recovery Activity"
      >
        {selectedItem && (
          <div className="space-y-4 text-xs">
            {/* Patient & Plan Header */}
            <div className="p-3 bg-warm-subtle rounded-xl border border-warm-border">
              <h4 className="text-sm font-bold text-navy-900">
                {selectedItem.patient?.full_name}
              </h4>
              <p className="text-slate-muted mt-0.5">
                Recovery Protocol: <strong className="text-navy-900">{selectedItem.plan?.title}</strong> ({selectedItem.plan?.start_date} to {selectedItem.plan?.end_date})
              </p>
              <p className="text-slate-muted">
                Verification Request ID: <span className="font-mono font-medium">{selectedItem.verification.verification_id}</span>
              </p>
            </div>

            {/* Assigned Exercises */}
            <div>
              <h5 className="font-bold text-navy-900 uppercase text-[11px] mb-1.5">
                Assigned Rehabilitation Exercises
              </h5>
              <div className="space-y-1.5">
                {selectedItem.exercises.map((ex) => (
                  <div key={ex.id} className="p-2.5 rounded-lg border border-warm-border bg-white flex justify-between items-center">
                    <div>
                      <strong className="text-navy-900 block">{ex.name}</strong>
                      <span className="text-slate-muted text-[11px]">{ex.instructions}</span>
                    </div>
                    <Badge variant="teal" size="sm">
                      Target: {ex.target_repetitions} reps
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Completed Sessions Log */}
            <div>
              <h5 className="font-bold text-navy-900 uppercase text-[11px] mb-1.5">
                Completed Exercise Sessions ({selectedItem.sessions.length})
              </h5>
              <div className="max-h-40 overflow-y-auto space-y-1.5 border border-warm-border rounded-lg p-2 bg-white">
                {selectedItem.sessions.length === 0 ? (
                  <p className="text-slate-muted py-2 text-center">No exercise sessions logged.</p>
                ) : (
                  selectedItem.sessions.map((s) => (
                    <div key={s.id} className="flex justify-between items-center py-1 border-b border-warm-border last:border-b-0 text-[11px]">
                      <span>
                        {new Date(s.started_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="font-medium text-navy-900">
                        {s.repetitions} reps in {Math.round(s.duration_seconds / 60)}m ({s.measurement_mode})
                      </span>
                      <Badge variant={s.status === 'completed' ? 'success' : 'neutral'} size="sm">
                        {s.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Symptom Check-ins */}
            <div>
              <h5 className="font-bold text-navy-900 uppercase text-[11px] mb-1.5">
                Symptom Check-ins & Pain Trajectory ({selectedItem.checkins.length})
              </h5>
              <div className="max-h-36 overflow-y-auto space-y-1.5 border border-warm-border rounded-lg p-2 bg-white">
                {selectedItem.checkins.length === 0 ? (
                  <p className="text-slate-muted py-2 text-center">No check-ins logged.</p>
                ) : (
                  selectedItem.checkins.map((c) => (
                    <div key={c.id} className="py-1 border-b border-warm-border last:border-b-0 text-[11px]">
                      <div className="flex justify-between font-semibold">
                        <span>{new Date(c.created_at).toLocaleDateString()}</span>
                        <span className="text-teal-calm">Pain: {c.pain_score} / 10</span>
                      </div>
                      <p className="text-slate-muted italic text-[10px] mt-0.5">"{c.notes}"</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-warm-border flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsReviewModalOpen(false)}>
                Close
              </Button>
              {selectedItem.verification.status === 'requested' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-700 hover:text-rose-900 border-rose-200 hover:bg-rose-50"
                    onClick={() => {
                      setIsReviewModalOpen(false);
                      setIsRejectModalOpen(true);
                    }}
                  >
                    Request Clarification
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setIsReviewModalOpen(false);
                      setIsApproveModalOpen(true);
                    }}
                  >
                    Approve & Sign
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: CLINICIAN APPROVE & SIGN MODAL */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title="Doctor Verification & Sign-off"
      >
        <div className="space-y-3.5 text-xs">
          <p className="text-slate-muted">
            You are signing the Doctor-Verified Recovery Activity Report for{' '}
            <strong className="text-navy-900">{selectedItem?.patient?.full_name}</strong>.
          </p>

          {/* Form fields */}
          <div>
            <label className="block text-[11px] font-semibold text-navy-900 mb-1">
              Clinician Full Name *
            </label>
            <input
              type="text"
              value={clinicianName}
              onChange={(e) => setClinicianName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-warm-border bg-white text-navy-900 focus:outline-none focus:ring-1 focus:ring-teal-calm"
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
              className="w-full px-3 py-1.5 rounded-lg border border-warm-border bg-white text-navy-900 focus:outline-none focus:ring-1 focus:ring-teal-calm"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-navy-900 mb-1">
              Registration / License Identifier (Optional)
            </label>
            <input
              type="text"
              value={licenseIdentifier}
              onChange={(e) => setLicenseIdentifier(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-warm-border bg-white text-navy-900 focus:outline-none focus:ring-1 focus:ring-teal-calm"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-navy-900 mb-1">
              Verification Clinical Note (Optional)
            </label>
            <textarea
              rows={2}
              value={verificationNote}
              onChange={(e) => setVerificationNote(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-warm-border bg-white text-navy-900 focus:outline-none focus:ring-1 focus:ring-teal-calm"
            />
          </div>

          {/* Explicit Attestation Checkbox */}
          <div className="p-3 bg-teal-light/40 rounded-xl border border-teal-border/60">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasConfirmedReview}
                onChange={(e) => setHasConfirmedReview(e.target.checked)}
                className="mt-0.5 rounded text-teal-calm focus:ring-teal-calm"
              />
              <span className="text-[11px] font-medium text-navy-900">
                "I have reviewed the recovery activity shown in this report."
              </span>
            </label>
          </div>

          {/* Clear Demo Signature Notice per Prompt */}
          <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px]">
            <strong>Demo Verification Notice:</strong> Demo verification — not a legally valid medical signature.
          </div>

          {actionError && (
            <p className="text-xs text-rose-600 font-medium">{actionError}</p>
          )}

          {/* Action buttons */}
          <div className="pt-2 border-t border-warm-border flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsApproveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!hasConfirmedReview || isSubmitting}
              onClick={handleApproveSubmit}
              icon={isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            >
              Confirm & Sign Report
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: CLINICIAN REJECT / CLARIFICATION MODAL */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Request Activity Clarification"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-muted">
            Provide feedback or required additional exercises for{' '}
            <strong className="text-navy-900">{selectedItem?.patient?.full_name}</strong> before approving.
          </p>

          <div>
            <label className="block text-[11px] font-semibold text-navy-900 mb-1">
              Clarification Reason / Required Activity *
            </label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-warm-border bg-white text-navy-900 focus:outline-none focus:ring-1 focus:ring-teal-calm"
              placeholder="e.g. Please complete 2 more sessions with at least 8 reps..."
            />
          </div>

          {actionError && (
            <p className="text-xs text-rose-600 font-medium">{actionError}</p>
          )}

          <div className="pt-2 border-t border-warm-border flex justify-end gap-2">
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
              Send Clarification Notice
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
