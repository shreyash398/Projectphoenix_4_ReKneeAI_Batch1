// ReKnee AI - Clinician Overview (Clinical Summary)
// Strictly answers: "What needs my attention right now?"
// Organized into:
// 1. Needs Attention (High-priority clinical alerts)
// 2. Pending Verification (Recovery reports awaiting sign-off)
// 3. Clinical Summary Metrics (Calculated from authorized data)
// 4. Recent Activity Stream (Concise event feed across authorized patients)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileCheck,
  Users,
  Activity,
  ClipboardList,
  RefreshCw,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import {
  Profile,
  Alert,
  RecoveryVerification,
  ExerciseSession,
  SymptomCheckin,
} from '../types/database';

interface ClinicalEvent {
  id: string;
  type: 'checkin' | 'session' | 'verification';
  patientId: string;
  patientName: string;
  timestamp: string;
  title: string;
  detail: string;
  badge?: string;
}

export const ClinicianDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [authorizedPatients, setAuthorizedPatients] = useState<Profile[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [verifications, setVerifications] = useState<RecoveryVerification[]>([]);
  const [recentEvents, setRecentEvents] = useState<ClinicalEvent[]>([]);

  const loadOverviewData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const authPatients = await repository.getClinicianAuthorizedPatients(activeProfile.id);
      const [allAlerts, allVerifications] = await Promise.all([
        repository.getAlerts(),
        repository.getVerifications(),
      ]);

      setAuthorizedPatients(authPatients);
      setAlerts(allAlerts);
      setVerifications(allVerifications);

      // Fetch recent sessions & checkins across authorized patients for Recent Activity stream
      const events: ClinicalEvent[] = [];

      await Promise.all(
        authPatients.map(async (patient) => {
          const [sessions, checkins]: [ExerciseSession[], SymptomCheckin[]] = await Promise.all([
            repository.getExerciseSessions(patient.id),
            repository.getSymptomCheckins(patient.id),
          ]);

          // Add check-ins
          checkins.slice(0, 3).forEach((c) => {
            events.push({
              id: `chk-${c.id}`,
              type: 'checkin',
              patientId: patient.id,
              patientName: patient.full_name,
              timestamp: c.created_at,
              title: 'Daily Symptom Check-in',
              detail: `Reported pain ${c.pain_score}/10${c.notes ? ` — "${c.notes.slice(0, 50)}${c.notes.length > 50 ? '...' : ''}"` : ''}`,
              badge: c.pain_score >= 7 ? 'High Pain' : undefined,
            });
          });

          // Add exercise sessions
          sessions.slice(0, 3).forEach((s) => {
            events.push({
              id: `sess-${s.id}`,
              type: 'session',
              patientId: patient.id,
              patientName: patient.full_name,
              timestamp: s.started_at,
              title: 'Exercise Session Completed',
              detail: `Completed ${s.repetitions} reps in ${Math.round(s.duration_seconds / 60)}m (${s.measurement_mode === 'manual_demo' ? 'Guided Motion' : 'Camera Vision'})`,
            });
          });
        })
      );

      // Add verification requests
      allVerifications.forEach((v) => {
        const pName = authPatients.find((p) => p.id === v.patient_id)?.full_name || 'Patient';
        events.push({
          id: `ver-${v.id}`,
          type: 'verification',
          patientId: v.patient_id,
          patientName: pName,
          timestamp: v.requested_at,
          title: 'Doctor Verification Requested',
          detail: 'Recovery activity completion report submitted for clinical review',
          badge: v.status === 'requested' ? 'Awaiting Review' : v.status,
        });
      });

      // Sort events newest first and take top 6
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentEvents(events.slice(0, 6));
    } catch (err: unknown) {
      console.error('Failed to load clinical overview data:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to load clinical overview.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeProfile.id]);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  // High priority alerts (unresolved clinical review alerts or urgent/critical severity)
  const highPriorityAlerts = useMemo(() => {
    return alerts
      .filter(
        (a) =>
          (a.status === 'new' || a.status === 'acknowledged') &&
          (a.category === 'clinical_review' || a.severity === 'critical' || a.severity === 'urgent')
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [alerts]);

  // Pending verification requests
  const pendingVerifications = useMemo(() => {
    return verifications.filter((v) => v.status === 'requested');
  }, [verifications]);

  // Distinct patients with alerts needing review
  const patientsWithAlertsCount = useMemo(() => {
    const alertPatientIds = new Set(
      alerts
        .filter((a) => a.status === 'new' || a.status === 'acknowledged')
        .map((a) => a.patient_id)
    );
    return alertPatientIds.size;
  }, [alerts]);

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return isToday ? `Today, ${timeStr}` : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  const getPatientName = (patientId: string) => {
    const found = authorizedPatients.find((p) => p.id === patientId);
    return found ? found.full_name : 'Patient';
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-4">
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
          <h2 className="text-base font-bold text-navy-900">Clinical Overview Unavailable</h2>
          <p className="text-xs text-slate-600">{errorMessage}</p>
          <Button size="sm" variant="outline" onClick={loadOverviewData} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-7 max-w-4xl mx-auto pb-12">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-xs font-semibold mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Clinical Telemetry
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">Clinical Overview</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time patient adherence, critical alerts, and verification queue
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/clinician/verifications')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:border-primary hover:text-primary transition-all shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Verifications</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
              {pendingVerifications.length}
            </span>
          </button>
          <button
            onClick={() => navigate('/clinician/alerts')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-semibold transition-all shadow-sm ${
              highPriorityAlerts.length > 0
                ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 ${highPriorityAlerts.length > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
            <span>Alerts</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              highPriorityAlerts.length > 0 ? 'bg-rose-200 text-rose-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {highPriorityAlerts.length}
            </span>
          </button>
        </div>
      </div>

      {/* ─── C. Patient Summary Metrics ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div
          onClick={() => navigate('/clinician/patients')}
          className="rounded-3xl bg-white p-5 border border-slate-100 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assigned Patients</span>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 group-hover:bg-primary-container group-hover:text-on-primary-container transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-on-surface tracking-tight">{authorizedPatients.length}</div>
          <p className="text-xs text-slate-500 mt-1 font-medium">Under your active clinical supervision</p>
        </div>

        <div
          onClick={() => navigate('/clinician/alerts')}
          className="rounded-3xl bg-white p-5 border border-slate-100 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Needs Triage</span>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              patientsWithAlertsCount > 0
                ? 'bg-rose-50 text-rose-600 group-hover:bg-rose-100'
                : 'bg-emerald-50 text-emerald-600'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-3xl font-extrabold tracking-tight ${
            patientsWithAlertsCount > 0 ? 'text-rose-600' : 'text-emerald-700'
          }`}>
            {patientsWithAlertsCount}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {patientsWithAlertsCount > 0 ? 'Patients with active clinical alerts' : 'All recovery indicators normal'}
          </p>
        </div>

        <div
          onClick={() => navigate('/clinician/verifications')}
          className="rounded-3xl bg-white p-5 border border-slate-100 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Verifications</span>
            <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-700 group-hover:bg-teal-100 transition-colors">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-on-surface tracking-tight">{pendingVerifications.length}</div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {pendingVerifications.length > 0 ? 'Activity reports awaiting review' : 'All requested reports signed off'}
          </p>
        </div>
      </div>

      {/* ─── A. Needs Attention (High-Priority Clinical Alerts) ───────────── */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
            <h2 className="text-base font-bold text-on-surface">Needs Immediate Attention</h2>
          </div>
          <span className="text-xs font-semibold text-rose-600">
            {highPriorityAlerts.length} urgent {highPriorityAlerts.length === 1 ? 'alert' : 'alerts'}
          </span>
        </div>

        {highPriorityAlerts.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 border border-slate-100 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] text-center flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>No urgent alerts requiring immediate clinical attention. All assigned patients are stable.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {highPriorityAlerts.map((alert) => {
              const patientName = getPatientName(alert.patient_id);
              const isAcknowledged = alert.status === 'acknowledged';

              return (
                <div
                  key={alert.id}
                  className="rounded-3xl bg-white p-5 border-l-4 border-l-rose-500 border-y border-r border-slate-100 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-800 font-bold text-xs flex items-center justify-center shrink-0">
                        {patientName.charAt(0)}
                      </div>
                      <span className="text-sm font-bold text-on-surface truncate">{patientName}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold uppercase tracking-wider">
                        High Priority
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                        {isAcknowledged ? 'Acknowledged' : 'New Alert'}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed pl-9">
                      {alert.reason}
                    </p>

                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pl-9">
                      <Clock className="w-3.5 h-3.5" />
                      Reported {formatTime(alert.created_at)}
                    </p>
                  </div>

                  <div className="shrink-0 sm:self-center pl-9 sm:pl-0">
                    <button
                      onClick={() => navigate(`/clinician/patients/${alert.patient_id}`)}
                      className="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-md shadow-rose-600/20 transition-all active:scale-95"
                    >
                      Review Alert
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── B. Pending Verification Requests ─────────────────────────────── */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-primary" />
            <h2 className="text-base font-bold text-on-surface">Pending Verification</h2>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {pendingVerifications.length} awaiting sign-off
          </span>
        </div>

        {pendingVerifications.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 border border-slate-100 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] text-center flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span>No recovery activity reports currently awaiting doctor review.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingVerifications.map((v) => {
              const patientName = getPatientName(v.patient_id);
              return (
                <div
                  key={v.id}
                  className="rounded-3xl bg-white p-5 border-l-4 border-l-primary border-y border-r border-slate-100 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                        {patientName.charAt(0)}
                      </div>
                      <span className="text-sm font-bold text-on-surface truncate">{patientName}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                        Pending Sign-off
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 font-medium pl-9">
                      Doctor-Verified Recovery Activity Report requested
                    </p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pl-9">
                      <Clock className="w-3.5 h-3.5" />
                      Submitted {formatTime(v.requested_at)}
                    </p>
                  </div>

                  <div className="shrink-0 sm:self-center pl-9 sm:pl-0">
                    <button
                      onClick={() => navigate('/clinician/verifications')}
                      className="px-4 py-2 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold text-xs shadow-md shadow-primary/20 transition-all active:scale-95"
                    >
                      Review Request
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── D. Recent Activity Stream ────────────────────────────────────── */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-bold text-on-surface">Recent Activity Stream</h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Across authorized patients
          </span>
        </div>

        {recentEvents.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 border border-slate-100 text-center text-xs text-slate-400">
            No recent activity recorded yet.
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] divide-y divide-slate-100 overflow-hidden">
            {recentEvents.map((event) => {
              const Icon =
                event.type === 'checkin'
                  ? ClipboardList
                  : event.type === 'session'
                  ? Activity
                  : FileCheck;

              const iconBg =
                event.type === 'checkin'
                  ? 'bg-amber-50 text-amber-600'
                  : event.type === 'session'
                  ? 'bg-sky-50 text-sky-600'
                  : 'bg-purple-50 text-purple-600';

              return (
                <div
                  key={event.id}
                  onClick={() => navigate(`/clinician/patients/${event.patientId}`)}
                  className="p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                          {event.patientName}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          • {event.title}
                        </span>
                        {event.badge && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold">
                            {event.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 truncate font-medium">
                        {event.detail}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-[11px] text-slate-400 hidden sm:inline font-medium">
                      {formatTime(event.timestamp)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Link to Patients Directory */}
        <div className="pt-2 text-center">
          <button
            onClick={() => navigate('/clinician/patients')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-primary hover:bg-primary-fixed/20 transition-all"
          >
            <span>Open complete patient directory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default ClinicianDashboard;
