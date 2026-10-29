// ReKnee AI - Clinician Patient Directory
// Strictly answers: "Which patients am I responsible for, and how can I open their records?"
// Provides search by name/ID, compact patient cards with recovery status, pain score, and record opening.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Activity,
  ClipboardList,
  FileCheck2,
  X,
} from 'lucide-react';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import {
  Profile,
  RecoveryPlan,
  SymptomCheckin,
  ExerciseSession,
  Alert,
} from '../types/database';

interface PatientRecordItem {
  patient: Profile;
  plan: RecoveryPlan | null;
  latestCheckin?: SymptomCheckin;
  latestSession?: ExerciseSession;
  unresolvedAlerts: Alert[];
  hasClinicalAlert: boolean;
}

export const ClinicianPatients: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [patients, setPatients] = useState<PatientRecordItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadPatients = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const authorizedPatients = await repository.getClinicianAuthorizedPatients(activeProfile.id);
      const allAlerts = await repository.getAlerts();

      const items: PatientRecordItem[] = await Promise.all(
        authorizedPatients.map(async (patient) => {
          const [plan, sessions, checkins] = await Promise.all([
            repository.getRecoveryPlan(patient.id),
            repository.getExerciseSessions(patient.id),
            repository.getSymptomCheckins(patient.id),
          ]);

          const patientAlerts = allAlerts.filter((a) => a.patient_id === patient.id);
          const unresolved = patientAlerts.filter(
            (a) => a.status === 'new' || a.status === 'acknowledged'
          );

          return {
            patient,
            plan,
            latestCheckin: checkins.length > 0 ? checkins[0] : undefined,
            latestSession: sessions.length > 0 ? sessions[0] : undefined,
            unresolvedAlerts: unresolved,
            hasClinicalAlert: unresolved.some((a) => a.category === 'clinical_review'),
          };
        })
      );

      setPatients(items);
    } catch (err: unknown) {
      console.error('Failed to load clinician patients directory:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to load authorized patient directory.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeProfile.id]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const [filterMode, setFilterMode] = useState<'all' | 'alert' | 'pain' | 'active'>('all');

  const filteredPatients = useMemo(() => {
    let result = patients;

    // Search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (item) =>
          item.patient.full_name.toLowerCase().includes(q) ||
          item.patient.id.toLowerCase().includes(q) ||
          (item.plan?.title && item.plan.title.toLowerCase().includes(q))
      );
    }

    // Filter mode
    if (filterMode === 'alert') {
      result = result.filter((item) => item.unresolvedAlerts.length > 0);
    } else if (filterMode === 'pain') {
      result = result.filter((item) => (item.latestCheckin?.pain_score ?? 0) >= 5);
    } else if (filterMode === 'active') {
      result = result.filter((item) => item.plan?.status === 'active' || !item.plan?.status);
    }

    return result;
  }, [patients, searchQuery, filterMode]);

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto py-4">
        <LoadingSkeleton lines={2} />
        <LoadingSkeleton lines={4} />
        <LoadingSkeleton lines={4} />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="max-w-xl mx-auto py-10">
        <div className="rounded-3xl p-6 border border-rose-200 bg-rose-50/50 text-center space-y-3 shadow-sm">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h2 className="text-base font-bold text-on-surface">Patient Directory Unavailable</h2>
          <p className="text-xs text-slate-600">{errorMessage}</p>
          <button
            onClick={loadPatients}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-2">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>{patients.length} Authorized Patients</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">Patient Directory</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Access assigned clinical records, rehabilitation trajectories, and logs
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or patient ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-10 pr-8 py-2.5 rounded-full border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-on-surface p-0.5"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterMode('all')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            filterMode === 'all'
              ? 'bg-on-surface text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All ({patients.length})
        </button>
        <button
          onClick={() => setFilterMode('alert')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            filterMode === 'alert'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:border-rose-300'
          }`}
        >
          Active Alerts ({patients.filter((p) => p.unresolvedAlerts.length > 0).length})
        </button>
        <button
          onClick={() => setFilterMode('pain')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            filterMode === 'pain'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:border-amber-300'
          }`}
        >
          Elevated Pain ≥5 ({patients.filter((p) => (p.latestCheckin?.pain_score ?? 0) >= 5).length})
        </button>
        <button
          onClick={() => setFilterMode('active')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            filterMode === 'active'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:border-primary'
          }`}
        >
          Active Protocol
        </button>
      </div>

      {/* Filter Info */}
      {(searchQuery || filterMode !== 'all') && (
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing <strong className="text-on-surface">{filteredPatients.length}</strong> of{' '}
            <strong className="text-on-surface">{patients.length}</strong> patients
          </span>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterMode('all');
            }}
            className="text-primary hover:underline font-semibold text-xs"
          >
            Reset all filters
          </button>
        </div>
      )}

      {/* Patient Directory List */}
      {filteredPatients.length === 0 ? (
        <div className="rounded-3xl p-10 text-center bg-white border border-slate-100 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-on-surface">
              {searchQuery ? 'No matching patients found' : 'No patients match criteria'}
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No authorized patients matched "${searchQuery}". Verify the spelling or identifier.`
                : 'Try adjusting the active filter chip to see more patient records.'}
            </p>
          </div>
          {(searchQuery || filterMode !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterMode('all');
              }}
              className="px-4 py-2 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredPatients.map((item) => {
            const hasAlert = item.unresolvedAlerts.length > 0;
            const patientInitial = item.patient.full_name?.charAt(0) || 'P';
            const shortId = item.patient.id.slice(0, 8);

            return (
              <div
                key={item.patient.id}
                className="rounded-3xl bg-white p-5 border border-slate-100 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] hover:shadow-card hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Patient Identity & Protocol */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-800 font-bold text-sm flex items-center justify-center shrink-0 border border-slate-200/60 shadow-sm">
                    {patientInitial}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm sm:text-base font-bold text-on-surface truncate">
                        {item.patient.full_name}
                      </h2>
                      <span className="text-[10px] font-mono font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        #{shortId}
                      </span>
                      {hasAlert ? (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.hasClinicalAlert
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {item.hasClinicalAlert ? 'Urgent Alert' : 'Active Alert'}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          On Track
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 font-medium">
                      {item.plan?.title || 'Post-TKA Rehabilitation Protocol'}
                    </p>

                    {item.plan?.start_date && (
                      <p className="text-[11px] text-slate-400">
                        Protocol started:{' '}
                        {new Date(item.plan.start_date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Middle: Clinical Indicators */}
                <div className="grid grid-cols-3 gap-3 py-3 border-y md:border-y-0 md:py-0 border-slate-100 text-xs">
                  {/* Latest Pain Score */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Pain Score
                    </span>
                    <div className="flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
                      {item.latestCheckin ? (
                        <span
                          className={`font-bold ${
                            item.latestCheckin.pain_score >= 7
                              ? 'text-rose-600'
                              : item.latestCheckin.pain_score >= 4
                              ? 'text-amber-600'
                              : 'text-emerald-700'
                          }`}
                        >
                          {item.latestCheckin.pain_score} / 10
                        </span>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </div>
                  </div>

                  {/* Latest Exercise Session */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Last Reps
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-slate-400" />
                      {item.latestSession ? (
                        <span className="font-semibold text-on-surface">
                          {item.latestSession.repetitions} reps
                        </span>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </div>
                  </div>

                  {/* Verification Status */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Status
                    </span>
                    <div className="flex items-center gap-1.5">
                      <FileCheck2 className="w-3.5 h-3.5 text-primary" />
                      <span className="text-slate-600 font-medium capitalize">
                        {item.plan?.status || 'Active'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Open Record Action */}
                <div className="flex items-center justify-end shrink-0">
                  <button
                    onClick={() => navigate(`/clinician/patients/${item.patient.id}`)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold text-xs shadow-md shadow-primary/20 transition-all active:scale-95"
                  >
                    <span>Open Record</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClinicianPatients;
