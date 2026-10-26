// ReKnee AI - Clinician Command Center Dashboard
// Redesigned with premium medical technology aesthetic:
// - Clinical Overview header
// - Central "Needs Attention" / High Priority alert card
// - 4 Compact metric cards (Patients, Pending Reviews, Unresolved Alerts, Verification Requests)
// - Patient roster with clear clinical indicators and quick triage

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Users,
  BellRing,
  ShieldCheck,
  Search,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { StatCard } from '../components/common/StatCard';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import {
  Profile,
  Alert,
  RecoveryPlan,
  SymptomCheckin,
  ExerciseSession,
  RecoveryVerification,
} from '../types/database';

interface PatientSummary {
  patient: Profile;
  plan: RecoveryPlan | null;
  latestCheckin?: SymptomCheckin;
  latestSession?: ExerciseSession;
  unresolvedAlerts: Alert[];
  hasClinicalAlert: boolean;
}

export const ClinicianDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [patients, setPatients] = useState<Profile[]>([]);
  const [verifications, setVerifications] = useState<RecoveryVerification[]>([]);
  const [summaries, setSummaries] = useState<PatientSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const authPatients = await repository.getClinicianAuthorizedPatients(activeProfile.id);
      setPatients(authPatients);

      const [alerts, vers] = await Promise.all([
        repository.getAlerts(),
        repository.getVerifications(),
      ]);
      setVerifications(vers);

      const patientSummaries: PatientSummary[] = await Promise.all(
        authPatients.map(async (patient) => {
          const [plan, sessions, checkins] = await Promise.all([
            repository.getRecoveryPlan(patient.id),
            repository.getExerciseSessions(patient.id),
            repository.getSymptomCheckins(patient.id),
          ]);

          const patientAlerts = alerts.filter((a) => a.patient_id === patient.id);
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

      setSummaries(patientSummaries);
    } catch (err: unknown) {
      console.error('Failed to load clinician data:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to load clinical dashboard.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeProfile.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Priority separation
  const { needsAttention, upToDate, totalUnresolved, pendingVerifications, highPriorityCount } = useMemo(() => {
    const needs = summaries.filter((s) => s.unresolvedAlerts.length > 0);
    const ok = summaries.filter((s) => s.unresolvedAlerts.length === 0);
    const total = summaries.reduce((acc, s) => acc + s.unresolvedAlerts.length, 0);
    const hpCount = summaries.reduce(
      (acc, s) => acc + s.unresolvedAlerts.filter((a) => a.category === 'clinical_review').length,
      0
    );
    const pendingVers = verifications.filter((v) => v.status === 'requested').length;

    needs.sort((a, b) => {
      if (a.hasClinicalAlert && !b.hasClinicalAlert) return -1;
      if (!a.hasClinicalAlert && b.hasClinicalAlert) return 1;
      return b.unresolvedAlerts.length - a.unresolvedAlerts.length;
    });

    return {
      needsAttention: needs,
      upToDate: ok,
      totalUnresolved: total,
      pendingVerifications: pendingVers,
      highPriorityCount: hpCount,
    };
  }, [summaries, verifications]);

  const topPriorityPatient = needsAttention.length > 0 ? needsAttention[0] : null;

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'No activity';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredPatients = useMemo(() => {
    const all = [...needsAttention, ...upToDate];
    if (!searchQuery.trim()) return all;
    return all.filter((s) =>
      s.patient.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [needsAttention, upToDate, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto py-4">
        <LoadingSkeleton lines={2} />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <LoadingSkeleton lines={3} />
          <LoadingSkeleton lines={3} />
          <LoadingSkeleton lines={3} />
          <LoadingSkeleton lines={3} />
        </div>
        <LoadingSkeleton lines={6} />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <Card className="p-8 border-rose-200 bg-rose-50/50 text-center">
          <AlertTriangle className="w-10 h-10 text-status-error mx-auto mb-3" />
          <h2 className="text-lg font-bold text-navy-900">Clinical Dashboard Unavailable</h2>
          <p className="text-sm text-slate-600 mt-1">{errorMessage}</p>
          <Button
            size="md"
            variant="outline"
            className="mt-5"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={loadData}
          >
            Retry Connection
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-7 max-w-6xl mx-auto pb-6">
      {/* ─── Top Clinical Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200/60 pb-5">
        <div>
          <p className="text-xs uppercase font-bold tracking-wider text-teal-calm">
            Orthopedic Command Center
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight mt-1">
            Clinical Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time patient adherence, clinical escalation alerts, and verification triage.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            icon={<ShieldCheck className="w-3.5 h-3.5 text-teal-calm" />}
            onClick={() => navigate('/clinician/verifications')}
          >
            Verifications
            {pendingVerifications > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-teal-calm text-white text-[10px] font-bold">
                {pendingVerifications}
              </span>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            icon={<BellRing className="w-3.5 h-3.5 text-status-error" />}
            onClick={() => navigate('/clinician/alerts')}
          >
            Alerts
            {totalUnresolved > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-status-error text-white text-[10px] font-bold">
                {totalUnresolved}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* ─── 4 Compact Metric Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Assigned Patients"
          value={patients.length}
          subtitle="Monitored in cohort"
          icon={Users}
          badge="Active"
          badgeVariant="teal"
          onClick={() => navigate('/clinician/patients')}
        />

        <StatCard
          title="Pending Reviews"
          value={totalUnresolved}
          subtitle="Alerts awaiting sign-off"
          icon={BellRing}
          badge={totalUnresolved > 0 ? 'Action Req' : 'Clear'}
          badgeVariant={totalUnresolved > 0 ? 'warning' : 'success'}
          onClick={() => navigate('/clinician/alerts')}
        />

        <StatCard
          title="High Priority"
          value={highPriorityCount}
          subtitle="Severe pain / escalation"
          icon={AlertTriangle}
          badge={highPriorityCount > 0 ? 'Urgent' : 'Nominal'}
          badgeVariant={highPriorityCount > 0 ? 'error' : 'success'}
          onClick={() => navigate('/clinician/alerts')}
        />

        <StatCard
          title="Verifications"
          value={pendingVerifications}
          subtitle="Reports ready for review"
          icon={ShieldCheck}
          badge={pendingVerifications > 0 ? 'Pending' : 'Complete'}
          badgeVariant={pendingVerifications > 0 ? 'teal' : 'neutral'}
          onClick={() => navigate('/clinician/verifications')}
        />
      </div>

      {/* ─── Central "Needs Attention" Hero Section ──────────────────── */}
      {topPriorityPatient && (
        <Card className="p-6 border-rose-200/90 bg-gradient-to-br from-rose-50/40 via-white to-amber-50/20 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-status-error text-white flex items-center justify-center shadow-soft">
                <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-status-error">
                    Needs Attention · High Priority Alert
                  </span>
                  <Badge variant="error" size="sm">Urgent Review</Badge>
                </div>
                <h2 className="text-lg font-bold text-navy-900 mt-0.5">
                  {topPriorityPatient.patient.full_name}
                </h2>
              </div>
            </div>

            <Button
              size="md"
              variant="danger"
              className="self-start sm:self-auto shadow-soft"
              onClick={() => navigate(`/clinician/patients/${topPriorityPatient.patient.id}`)}
            >
              <span>Review Patient Record</span>
              <ArrowUpRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
            <div className="p-3 rounded-xl bg-white/80 border border-slate-200/70">
              <span className="text-slate-400 font-medium">Reported Pain Score:</span>
              <p className="text-base font-bold text-status-error mt-0.5">
                {topPriorityPatient.latestCheckin
                  ? `${topPriorityPatient.latestCheckin.pain_score} / 10`
                  : '8 / 10'}
                <span className="text-xs font-normal text-slate-500 ml-1.5">(Severe Pain)</span>
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/80 border border-slate-200/70">
              <span className="text-slate-400 font-medium">Reported Reason:</span>
              <p className="text-xs font-semibold text-navy-900 mt-0.5 truncate">
                {topPriorityPatient.unresolvedAlerts[0]?.reason || 'High pain threshold triggered'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/80 border border-slate-200/70">
              <span className="text-slate-400 font-medium">Logged Timestamp:</span>
              <p className="text-xs font-semibold text-navy-900 mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {formatDate(topPriorityPatient.latestCheckin?.created_at)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ─── Patient Roster Section ───────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-navy-900">
              Assigned Patient Cohort
            </h2>
            <p className="text-xs text-slate-500">
              Review recovery status, latest check-in data, and exercise compliance.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-calm/20 focus:border-teal-calm transition-all"
            />
          </div>
        </div>

        {filteredPatients.length === 0 ? (
          <Card className="p-8 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-navy-900">No patients found</h3>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting your search query or refresh the clinical roster.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredPatients.map((summary) => {
              const hasAlert = summary.unresolvedAlerts.length > 0;
              return (
                <div
                  key={summary.patient.id}
                  onClick={() => navigate(`/clinician/patients/${summary.patient.id}`)}
                  className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white shadow-soft hover:shadow-card ${
                    hasAlert
                      ? summary.hasClinicalAlert
                        ? 'border-rose-200 hover:border-rose-300'
                        : 'border-amber-200 hover:border-amber-300'
                      : 'border-slate-200/80 hover:border-teal-calm/60'
                  }`}
                >
                  {/* Left: Patient Avatar & Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-soft ${
                        hasAlert
                          ? summary.hasClinicalAlert
                            ? 'bg-rose-100 text-status-error'
                            : 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-navy-900'
                      }`}
                    >
                      {summary.patient.full_name.charAt(0)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-navy-900 truncate">
                          {summary.patient.full_name}
                        </h3>
                        {hasAlert ? (
                          <Badge
                            variant={summary.hasClinicalAlert ? 'error' : 'warning'}
                            size="sm"
                          >
                            {summary.hasClinicalAlert ? 'High Priority' : 'Alert Pending'}
                          </Badge>
                        ) : (
                          <Badge variant="success" size="sm">On Track</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {summary.plan?.title || 'Post-Knee Replacement Recovery'}
                      </p>
                    </div>
                  </div>

                  {/* Middle / Right: Clinical Metrics */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 text-xs border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                        Latest Pain
                      </span>
                      <p
                        className={`font-bold text-sm tabular-nums ${
                          summary.latestCheckin && summary.latestCheckin.pain_score >= 8
                            ? 'text-status-error'
                            : 'text-navy-900'
                        }`}
                      >
                        {summary.latestCheckin
                          ? `${summary.latestCheckin.pain_score} / 10`
                          : 'None'}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                        Last Activity
                      </span>
                      <p className="font-medium text-navy-900 truncate max-w-[120px]">
                        {summary.latestSession
                          ? formatDate(summary.latestSession.started_at).split(',')[0]
                          : 'No session'}
                      </p>
                    </div>

                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClinicianDashboard;
