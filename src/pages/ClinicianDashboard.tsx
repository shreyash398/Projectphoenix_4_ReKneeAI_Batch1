// ReKnee AI - Clinician Overview & Patients Dashboard
// Adheres strictly to 01_PRD.md, 02_DESIGN.md, 04_DATABASE.md, 05_API.md, 11_AUTH_AUTHORIZATION.md, and 14_TESTING_QA.md
// Displays:
// 1. Overview (/clinician):
//    - Patient count
//    - Active recovery plans
//    - Recent sessions (past 7 days & feed)
//    - Check-in activity (past 7 days, pain average, feed)
//    - Unresolved alerts (clinical escalation vs engagement)
// 2. Patients (/clinician/patients):
//    - Patient name/identifier
//    - Recovery plan status
//    - Recent activity timestamp & details
//    - Latest check-in pain & notes
//    - Unresolved alert indicator badge
//    - Action link to Patient Detail (/clinician/patients/:id)
// Security:
//    - Strict isolation: Only patients with authorized clinician_patient_access are retrieved
//    - Clear neutral language, no AI diagnosis, no automated clinical decisions

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  Activity,
  ClipboardCheck,
  AlertTriangle,
  ChevronRight,
  Stethoscope,
  Search,
  Clock,
  CheckCircle2,
  BellRing,
  ArrowRight,
  RefreshCw,
  FileText,
  CalendarHeart,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import {
  Profile,
  Alert,
  RecoveryPlan,
  SymptomCheckin,
  ExerciseSession,
} from '../types/database';

interface PatientRecordSummary {
  patient: Profile;
  plan: RecoveryPlan | null;
  sessions: ExerciseSession[];
  checkins: SymptomCheckin[];
  alerts: Alert[];
  latestSession?: ExerciseSession;
  latestCheckin?: SymptomCheckin;
  unresolvedAlertCount: number;
  hasClinicalEscalation: boolean;
}

export const ClinicianDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

  // Determine active view: Overview (/clinician) vs Patients (/clinician/patients)
  const isPatientsView = location.pathname.includes('/patients');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [patients, setPatients] = useState<Profile[]>([]);
  const [allAlerts, setAllAlerts] = useState<Alert[]>([]);
  const [patientSummaries, setPatientSummaries] = useState<PatientRecordSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadClinicianData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // 1. Fetch authorized patients strictly scoped to this clinician
      const authPatients = await repository.getClinicianAuthorizedPatients(activeProfile.id);
      setPatients(authPatients);

      // 2. Fetch alerts scoped to authorized patients
      const alerts = await repository.getAlerts();
      setAllAlerts(alerts);

      // 3. Aggregate patient summaries for all authorized patients
      const summaries: PatientRecordSummary[] = await Promise.all(
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
          const hasClinical = unresolved.some((a) => a.category === 'clinical_review');

          return {
            patient,
            plan,
            sessions,
            checkins,
            alerts: patientAlerts,
            latestSession: sessions.length > 0 ? sessions[0] : undefined,
            latestCheckin: checkins.length > 0 ? checkins[0] : undefined,
            unresolvedAlertCount: unresolved.length,
            hasClinicalEscalation: hasClinical,
          };
        })
      );

      setPatientSummaries(summaries);
    } catch (err: unknown) {
      console.error('Failed to load clinician dashboard data:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to load clinical dashboard records.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeProfile.id]);

  useEffect(() => {
    loadClinicianData();
  }, [loadClinicianData]);

  // Aggregate Metrics for Overview
  const metrics = useMemo(() => {
    const patientCount = patients.length;
    const activePlansCount = patientSummaries.filter(
      (s) => s.plan && s.plan.status === 'active'
    ).length;

    // All sessions across patients
    const allSessions = patientSummaries.flatMap((s) => s.sessions);
    // Recent sessions in past 7 days
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recentSessionsPast7d = allSessions.filter(
      (s) => new Date(s.started_at).getTime() >= sevenDaysAgo
    );

    // All check-ins across patients
    const allCheckins = patientSummaries.flatMap((s) => s.checkins);
    const recentCheckinsPast7d = allCheckins.filter(
      (c) => new Date(c.created_at).getTime() >= sevenDaysAgo
    );
    const averagePain =
      recentCheckinsPast7d.length > 0
        ? (
            recentCheckinsPast7d.reduce((sum, c) => sum + c.pain_score, 0) /
            recentCheckinsPast7d.length
          ).toFixed(1)
        : null;

    // Unresolved alerts
    const unresolvedAlerts = allAlerts.filter(
      (a) => a.status === 'new' || a.status === 'acknowledged'
    );
    const clinicalAlertsCount = unresolvedAlerts.filter(
      (a) => a.category === 'clinical_review'
    ).length;
    const engagementAlertsCount = unresolvedAlerts.filter(
      (a) => a.category === 'engagement'
    ).length;

    return {
      patientCount,
      activePlansCount,
      totalSessions: allSessions.length,
      recentSessionsCount: recentSessionsPast7d.length,
      allSessionsSorted: allSessions.sort(
        (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      ),
      totalCheckins: allCheckins.length,
      recentCheckinsCount: recentCheckinsPast7d.length,
      averagePain,
      allCheckinsSorted: allCheckins.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      unresolvedAlertsCount: unresolvedAlerts.length,
      clinicalAlertsCount,
      engagementAlertsCount,
      unresolvedAlerts,
    };
  }, [patients, patientSummaries, allAlerts]);

  // Filtered patients for Patients View
  const filteredSummaries = useMemo(() => {
    if (!searchQuery.trim()) return patientSummaries;
    const query = searchQuery.toLowerCase();
    return patientSummaries.filter(
      (s) =>
        s.patient.full_name.toLowerCase().includes(query) ||
        s.patient.id.toLowerCase().includes(query) ||
        s.plan?.title.toLowerCase().includes(query)
    );
  }, [patientSummaries, searchQuery]);

  // Helper to format dates cleanly
  const formatDate = (isoString?: string) => {
    if (!isoString) return 'No activity recorded';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Helper to find patient name from ID
  const getPatientName = (patientId: string) => {
    const p = patients.find((pat) => pat.id === patientId);
    return p?.full_name || `Patient ${patientId.substring(0, 8)}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <LoadingSkeleton lines={2} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
      <div className="space-y-4 max-w-4xl mx-auto">
        <Card className="p-6 border-status-error/30 bg-rose-50/50 text-center">
          <AlertTriangle className="w-8 h-8 text-status-error mx-auto mb-2" />
          <h2 className="text-base font-bold text-navy-900">Clinical Data Access Error</h2>
          <p className="text-xs text-slate-muted mt-1 max-w-md mx-auto">{errorMessage}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={loadClinicianData}
          >
            Retry Loading Records
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Clinician Header with Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-teal-calm tracking-wide uppercase">
              Clinician Oversight Portal
            </span>
            <Badge variant="teal" size="sm" icon={<Stethoscope className="w-3 h-3" />}>
              Licensed Provider
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-900 tracking-tight mt-0.5">
            {isPatientsView ? 'Authorized Patient Roster' : 'Clinical Recovery Overview'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-muted mt-0.5">
            {isPatientsView
              ? 'Individual recovery protocol tracking, adherence milestones, and symptom vigilance.'
              : 'Holistic clinical oversight of assigned recovery plans, sessions, check-ins, and alerts.'}
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-warm-subtle rounded-xl border border-warm-border self-start sm:self-auto">
          <button
            onClick={() => navigate('/clinician')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              !isPatientsView
                ? 'bg-white text-navy-900 shadow-soft'
                : 'text-slate-muted hover:text-navy-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => navigate('/clinician/patients')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              isPatientsView
                ? 'bg-white text-navy-900 shadow-soft'
                : 'text-slate-muted hover:text-navy-900'
            }`}
          >
            Patients ({patients.length})
          </button>
          <button
            onClick={() => navigate('/clinician/alerts')}
            className="relative px-3 py-1.5 text-xs font-semibold text-slate-muted hover:text-navy-900 rounded-lg transition-all"
          >
            <span>Alerts</span>
            {metrics.unresolvedAlertsCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-status-error text-white text-[10px] font-bold rounded-full">
                {metrics.unresolvedAlertsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* VIEW 1: OVERVIEW SCREEN (/clinician) */}
      {!isPatientsView && (
        <div className="space-y-5">
          {/* Top 5 Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* 1. Patient Count */}
            <Card className="p-3.5 bg-white">
              <div className="flex items-center justify-between text-slate-muted mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Patients</span>
                <Users className="w-4 h-4 text-teal-calm" />
              </div>
              <p className="text-2xl font-bold text-navy-900 tracking-tight">
                {metrics.patientCount}
              </p>
              <p className="text-[10px] text-slate-muted mt-0.5">Assigned to provider</p>
            </Card>

            {/* 2. Active Recovery Plans */}
            <Card className="p-3.5 bg-white">
              <div className="flex items-center justify-between text-slate-muted mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Active Plans</span>
                <ClipboardCheck className="w-4 h-4 text-teal-calm" />
              </div>
              <p className="text-2xl font-bold text-navy-900 tracking-tight">
                {metrics.activePlansCount}
              </p>
              <p className="text-[10px] text-slate-muted mt-0.5">Prescribed protocols</p>
            </Card>

            {/* 3. Recent Sessions */}
            <Card className="p-3.5 bg-white">
              <div className="flex items-center justify-between text-slate-muted mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Recent Sessions</span>
                <Activity className="w-4 h-4 text-teal-calm" />
              </div>
              <p className="text-2xl font-bold text-navy-900 tracking-tight">
                {metrics.recentSessionsCount}
              </p>
              <p className="text-[10px] text-slate-muted mt-0.5">Completed past 7 days</p>
            </Card>

            {/* 4. Check-in Activity */}
            <Card className="p-3.5 bg-white">
              <div className="flex items-center justify-between text-slate-muted mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Check-in Activity</span>
                <CalendarHeart className="w-4 h-4 text-teal-calm" />
              </div>
              <p className="text-2xl font-bold text-navy-900 tracking-tight">
                {metrics.recentCheckinsCount}
              </p>
              <p className="text-[10px] text-slate-muted mt-0.5">
                {metrics.averagePain ? `Avg pain ${metrics.averagePain}/10` : 'Past 7 days'}
              </p>
            </Card>

            {/* 5. Unresolved Alerts */}
            <Card
              className={`p-3.5 col-span-2 sm:col-span-1 cursor-pointer transition-colors ${
                metrics.unresolvedAlertsCount > 0
                  ? metrics.clinicalAlertsCount > 0
                    ? 'bg-rose-50/70 border-rose-200 hover:bg-rose-50'
                    : 'bg-amber-50/70 border-amber-200 hover:bg-amber-50'
                  : 'bg-white'
              }`}
              onClick={() => navigate('/clinician/alerts')}
            >
              <div className="flex items-center justify-between text-slate-muted mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Unresolved</span>
                <BellRing
                  className={`w-4 h-4 ${
                    metrics.clinicalAlertsCount > 0 ? 'text-status-error' : 'text-status-warning'
                  }`}
                />
              </div>
              <p className="text-2xl font-bold text-navy-900 tracking-tight">
                {metrics.unresolvedAlertsCount}
              </p>
              <p className="text-[10px] text-slate-muted mt-0.5">
                {metrics.clinicalAlertsCount} clinical · {metrics.engagementAlertsCount} reminder
              </p>
            </Card>
          </div>

          {/* Unresolved Alerts Spotlight (if any) */}
          {metrics.unresolvedAlertsCount > 0 && (
            <Card className="bg-amber-50/50 border-amber-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-navy-900">
                      {metrics.unresolvedAlertsCount} Unresolved Alert
                      {metrics.unresolvedAlertsCount > 1 ? 's' : ''} Require Attention
                    </h3>
                    <p className="text-xs text-slate-muted mt-0.5">
                      {metrics.clinicalAlertsCount > 0
                        ? `${metrics.clinicalAlertsCount} clinical escalation alert(s) logged. Review symptoms and record audit response.`
                        : 'Adherence reminders active. Note: Missed sessions are not medical emergencies.'}
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0"
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                  onClick={() => navigate('/clinician/alerts')}
                >
                  Review Queue
                </Button>
              </div>

              {/* Top 3 Unresolved Alerts Mini-List */}
              <div className="mt-3 divide-y divide-amber-200/60 border-t border-amber-200/60 pt-2 space-y-2">
                {metrics.unresolvedAlerts.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-navy-900">
                          {getPatientName(alert.patient_id)}
                        </span>
                        <Badge
                          variant={
                            alert.category === 'clinical_review'
                              ? 'error'
                              : 'engagement'
                          }
                          size="sm"
                        >
                          {alert.category === 'clinical_review'
                            ? 'Clinical Escalation'
                            : 'Engagement Reminder'}
                        </Badge>
                        <span className="text-[10px] text-slate-subtle">
                          {formatDate(alert.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-muted mt-0.5">{alert.reason}</p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs shrink-0 self-start sm:self-auto py-1"
                      onClick={() => navigate(`/clinician/patients/${alert.patient_id}`)}
                    >
                      Patient Chart
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Two-Column Section: Recent Sessions vs Recent Check-in Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recent Exercise Sessions Log */}
            <Card className="p-4">
              <div className="flex items-center justify-between pb-3 border-b border-warm-border">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-calm" />
                  <h2 className="text-sm font-bold text-navy-900">Recent Exercise Sessions</h2>
                </div>
                <span className="text-[11px] text-slate-muted">
                  {metrics.allSessionsSorted.length} Total Logged
                </span>
              </div>

              {metrics.allSessionsSorted.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-muted">
                  <Activity className="w-6 h-6 text-slate-subtle mx-auto mb-1 opacity-50" />
                  No exercise sessions recorded yet across assigned patients.
                </div>
              ) : (
                <div className="divide-y divide-warm-border mt-1">
                  {metrics.allSessionsSorted.slice(0, 5).map((session) => (
                    <div key={session.id} className="py-2.5 text-xs flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-navy-900">
                          {getPatientName(session.patient_id)}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-muted mt-0.5">
                          <span>
                            {session.repetitions} reps · {session.duration_seconds}s
                          </span>
                          <span>·</span>
                          <span className="capitalize">{session.measurement_mode} mode</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-subtle block">
                          {formatDate(session.started_at)}
                        </span>
                        <Badge
                          variant={session.status === 'completed' ? 'teal' : 'neutral'}
                          size="sm"
                        >
                          {session.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Check-in Activity Feed */}
            <Card className="p-4">
              <div className="flex items-center justify-between pb-3 border-b border-warm-border">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-teal-calm" />
                  <h2 className="text-sm font-bold text-navy-900">Recent Check-in Activity</h2>
                </div>
                <span className="text-[11px] text-slate-muted">
                  {metrics.allCheckinsSorted.length} Total Logged
                </span>
              </div>

              {metrics.allCheckinsSorted.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-muted">
                  <ClipboardCheck className="w-6 h-6 text-slate-subtle mx-auto mb-1 opacity-50" />
                  No symptom check-ins submitted yet.
                </div>
              ) : (
                <div className="divide-y divide-warm-border mt-1">
                  {metrics.allCheckinsSorted.slice(0, 5).map((chk) => (
                    <div key={chk.id} className="py-2.5 text-xs flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-navy-900">
                          {getPatientName(chk.patient_id)}
                        </p>
                        <p className="text-[11px] text-slate-muted mt-0.5">
                          {chk.notes || 'No patient symptom commentary logged.'}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-subtle mt-1">
                          {chk.symptoms?.swelling && <span className="text-status-warning font-medium">Swelling</span>}
                          {chk.symptoms?.redness && <span className="text-status-warning font-medium">Redness</span>}
                          {chk.symptoms?.fever && <span className="text-status-error font-medium">Fever</span>}
                          {!chk.symptoms?.swelling && !chk.symptoms?.redness && !chk.symptoms?.fever && (
                            <span>No inflammation reported</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge
                          variant={chk.pain_score >= 7 ? 'error' : chk.pain_score >= 4 ? 'warning' : 'teal'}
                          size="sm"
                        >
                          Pain {chk.pain_score}/10
                        </Badge>
                        <span className="text-[10px] text-slate-subtle block mt-1">
                          {formatDate(chk.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Quick Roster Preview Link */}
          <div className="flex items-center justify-between p-3.5 bg-warm-subtle rounded-xl border border-warm-border text-xs">
            <div>
              <span className="font-semibold text-navy-900">Managing {patients.length} Recovery Patients</span>
              <p className="text-[11px] text-slate-muted mt-0.5">
                View individual patient charts, detailed range of motion progression, and prescribed exercise regimens.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              icon={<ChevronRight className="w-3.5 h-3.5" />}
              onClick={() => navigate('/clinician/patients')}
            >
              Open Patients Roster
            </Button>
          </div>
        </div>
      )}

      {/* VIEW 2: PATIENTS ROSTER SCREEN (/clinician/patients) */}
      {isPatientsView && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-subtle absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search patient name, identifier, or protocol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-warm-border bg-white text-navy-900 focus:outline-none focus:border-teal-calm"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-muted">
                Showing {filteredSummaries.length} of {patients.length} patients
              </span>
            </div>
          </div>

          {/* Patient Cards / Roster */}
          {filteredSummaries.length === 0 ? (
            <Card className="p-8 text-center">
              <Users className="w-8 h-8 text-slate-subtle mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-bold text-navy-900">No Authorized Patients Found</h3>
              <p className="text-xs text-slate-muted mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No patient records matched "${searchQuery}". Clear your search query to see all assigned patients.`
                  : 'There are currently no patients assigned to your clinician account.'}
              </p>
              {searchQuery && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setSearchQuery('')}
                >
                  Clear Search Filter
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredSummaries.map((summary) => {
                const {
                  patient,
                  plan,
                  latestSession,
                  latestCheckin,
                  unresolvedAlertCount,
                  hasClinicalEscalation,
                } = summary;

                return (
                  <Card
                    key={patient.id}
                    className="p-4 hover:border-teal-calm/60 transition-all shadow-card"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-warm-border">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-navy-900 text-white flex items-center justify-center font-bold text-sm shadow-soft shrink-0">
                          {patient.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-navy-900">{patient.full_name}</h3>
                            <span className="text-[10px] text-slate-subtle">
                              ID: {patient.id.substring(0, 8)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-muted mt-0.5">
                            Recovery Plan:{' '}
                            <span className="font-semibold text-teal-calm">
                              {plan?.title || 'No active protocol assigned'}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Right Header: Alerts Indicator & Open Patient Action */}
                      <div className="flex items-center gap-2">
                        {unresolvedAlertCount > 0 ? (
                          <Badge
                            variant={hasClinicalEscalation ? 'error' : 'warning'}
                            size="sm"
                            icon={<AlertTriangle className="w-3 h-3" />}
                          >
                            {unresolvedAlertCount} Alert{unresolvedAlertCount > 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <Badge
                            variant="teal"
                            size="sm"
                            icon={<CheckCircle2 className="w-3 h-3" />}
                          >
                            Up to Date
                          </Badge>
                        )}

                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<ChevronRight className="w-3.5 h-3.5" />}
                          onClick={() => navigate(`/clinician/patients/${patient.id}`)}
                        >
                          View Chart
                        </Button>
                      </div>
                    </div>

                    {/* Patient Snapshot Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
                      {/* Plan Status & Timeline */}
                      <div className="bg-warm-bg p-2.5 rounded-lg border border-warm-border">
                        <div className="flex items-center gap-1.5 text-slate-subtle text-[10px] font-semibold uppercase">
                          <FileText className="w-3 h-3 text-teal-calm" />
                          <span>Recovery Plan Status</span>
                        </div>
                        <p className="text-sm font-bold text-navy-900 mt-1 capitalize">
                          {plan?.status || 'Inactive'}
                        </p>
                        <p className="text-[11px] text-slate-muted mt-0.5">
                          {plan?.start_date
                            ? `Started: ${new Date(plan.start_date).toLocaleDateString()}`
                            : 'Standard TKA Protocol'}
                        </p>
                      </div>

                      {/* Recent Activity */}
                      <div className="bg-warm-bg p-2.5 rounded-lg border border-warm-border">
                        <div className="flex items-center gap-1.5 text-slate-subtle text-[10px] font-semibold uppercase">
                          <Clock className="w-3 h-3 text-teal-calm" />
                          <span>Recent Activity</span>
                        </div>
                        <p className="text-sm font-bold text-navy-900 mt-1">
                          {latestSession
                            ? `${latestSession.repetitions} reps logged`
                            : latestCheckin
                            ? 'Check-in logged'
                            : 'No recent sessions'}
                        </p>
                        <p className="text-[11px] text-slate-muted mt-0.5 truncate">
                          {latestSession
                            ? formatDate(latestSession.started_at)
                            : latestCheckin
                            ? formatDate(latestCheckin.created_at)
                            : 'Awaiting first exercise'}
                        </p>
                      </div>

                      {/* Latest Check-in & Symptoms */}
                      <div className="bg-warm-bg p-2.5 rounded-lg border border-warm-border">
                        <div className="flex items-center gap-1.5 text-slate-subtle text-[10px] font-semibold uppercase">
                          <ClipboardCheck className="w-3 h-3 text-teal-calm" />
                          <span>Latest Check-in</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-sm font-bold text-navy-900">
                            {latestCheckin ? `Pain ${latestCheckin.pain_score}/10` : 'None logged'}
                          </span>
                          {latestCheckin && (
                            <span className="text-[10px] text-slate-subtle">
                              {formatDate(latestCheckin.created_at)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-muted mt-0.5 truncate">
                          {latestCheckin?.notes || 'No acute symptoms reported.'}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Clinical Responsibility & Safety Governance Footnote */}
      <div className="p-3 bg-warm-subtle rounded-xl border border-warm-border text-xs text-slate-muted leading-relaxed">
        <strong className="text-navy-900 font-semibold block mb-0.5">
          Clinical Decision Support & Authorization Notice:
        </strong>
        ReKnee AI automated rules and alert indicators are clinical decision-support aids. They do
        not replace formal clinical evaluation or institutional emergency protocols. Licensed
        clinicians remain responsible for all medical assessments and treatment alterations. Only
        patients with explicit authorized clinical relationships can be accessed.
      </div>
    </div>
  );
};

export default ClinicianDashboard;
