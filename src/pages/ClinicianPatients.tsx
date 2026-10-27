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
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
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

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (item) =>
        item.patient.full_name.toLowerCase().includes(q) ||
        item.patient.id.toLowerCase().includes(q) ||
        (item.plan?.title && item.plan.title.toLowerCase().includes(q))
    );
  }, [patients, searchQuery]);

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
        <Card className="p-6 border-rose-200 bg-rose-50/50 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h2 className="text-base font-bold text-navy-900">Patient Directory Unavailable</h2>
          <p className="text-xs text-slate-600">{errorMessage}</p>
          <Button size="sm" variant="outline" onClick={loadPatients} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Patients</h1>
            <Badge variant="neutral" size="sm">
              {patients.length} Assigned
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Which patients am I responsible for, and how can I open their records?
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or patient ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-teal-calm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-navy-900 p-0.5"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Info */}
      {searchQuery && (
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing <strong className="text-navy-900">{filteredPatients.length}</strong> of{' '}
            <strong className="text-navy-900">{patients.length}</strong> authorized patients
          </span>
          <button
            onClick={() => setSearchQuery('')}
            className="text-teal-calm hover:underline font-medium text-[11px]"
          >
            Reset filter
          </button>
        </div>
      )}

      {/* Patient Directory List */}
      {filteredPatients.length === 0 ? (
        <Card className="p-10 text-center bg-white space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-navy-900">
              {searchQuery ? 'No matching patients found' : 'No assigned patients'}
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No authorized patients matched "${searchQuery}". Verify the spelling or patient identifier.`
                : 'There are currently no patients linked to your clinical care account under Row Level Security access rules.'}
            </p>
          </div>
          {searchQuery && (
            <Button size="sm" variant="outline" onClick={() => setSearchQuery('')}>
              Clear Search
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPatients.map((item) => {
            const hasAlert = item.unresolvedAlerts.length > 0;
            const patientInitial = item.patient.full_name?.charAt(0) || 'P';
            const shortId = item.patient.id.slice(0, 8);

            return (
              <Card
                key={item.patient.id}
                className="p-4 sm:p-5 bg-white border border-slate-200/80 shadow-soft hover:border-teal-calm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Patient Identity & Protocol */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-navy-900 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-soft">
                    {patientInitial}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-navy-900 truncate">
                        {item.patient.full_name}
                      </h2>
                      <span className="text-[10px] font-mono font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        #{shortId}
                      </span>
                      {hasAlert ? (
                        <Badge variant={item.hasClinicalAlert ? 'error' : 'warning'} size="sm">
                          {item.hasClinicalAlert ? 'Urgent Alert' : 'Active Alert'}
                        </Badge>
                      ) : (
                        <Badge variant="success" size="sm">
                          On Track
                        </Badge>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2 border-y md:border-y-0 md:py-0 border-slate-100 text-xs">
                  {/* Latest Pain Score */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Reported Pain
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
                              : 'text-teal-calm'
                          }`}
                        >
                          {item.latestCheckin.pain_score} / 10
                        </span>
                      ) : (
                        <span className="text-slate-400">None logged</span>
                      )}
                    </div>
                  </div>

                  {/* Latest Exercise Session */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Last Session
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-slate-400" />
                      {item.latestSession ? (
                        <span className="font-semibold text-navy-900">
                          {item.latestSession.repetitions} reps
                        </span>
                      ) : (
                        <span className="text-slate-400">No session</span>
                      )}
                    </div>
                  </div>

                  {/* Verification Status */}
                  <div className="space-y-0.5 col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Status
                    </span>
                    <div className="flex items-center gap-1.5">
                      <FileCheck2 className="w-3.5 h-3.5 text-teal-calm" />
                      <span className="text-slate-600 font-medium capitalize">
                        {item.plan?.status || 'Active'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Open Record Action */}
                <div className="flex items-center justify-end shrink-0">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => navigate(`/clinician/patients/${item.patient.id}`)}
                    icon={<ChevronRight className="w-4 h-4" />}
                  >
                    Open Record
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClinicianPatients;
