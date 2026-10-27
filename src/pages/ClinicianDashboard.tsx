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
import { Badge } from '../components/common/Badge';
import { MetricCard } from '../components/common/MetricCard';
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Clinical Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            What needs my attention right now?
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/clinician/verifications')}
            icon={<ShieldCheck className="w-3.5 h-3.5 text-teal-calm" />}
          >
            Verifications ({pendingVerifications.length})
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/clinician/alerts')}
            icon={<AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
          >
            Alerts ({highPriorityAlerts.length})
          </Button>
        </div>
      </div>

      {/* ─── C. Patient Summary Metrics ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          label="Assigned Patients"
          value={authorizedPatients.length}
          sublabel="Under your active clinical care"
          icon={<Users className="w-4 h-4" />}
          onClick={() => navigate('/clinician/patients')}
        />
        <MetricCard
          label="Patients With Alerts"
          value={patientsWithAlertsCount}
          sublabel={patientsWithAlertsCount > 0 ? 'Require clinical triage' : 'All patients within normal thresholds'}
          icon={<AlertTriangle className="w-4 h-4" />}
          iconBgColor={patientsWithAlertsCount > 0 ? 'bg-rose-50' : 'bg-emerald-50'}
          iconColor={patientsWithAlertsCount > 0 ? 'text-rose-600' : 'text-emerald-600'}
          onClick={() => navigate('/clinician/alerts')}
        />
        <MetricCard
          label="Pending Verifications"
          value={pendingVerifications.length}
          sublabel={pendingVerifications.length > 0 ? 'Awaiting clinical review' : 'All requests completed'}
          icon={<FileCheck className="w-4 h-4" />}
          iconBgColor="bg-teal-light"
          iconColor="text-teal-calm"
          onClick={() => navigate('/clinician/verifications')}
        />
      </div>

      {/* ─── A. Needs Attention (High-Priority Clinical Alerts) ───────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
            <h2 className="text-base font-bold text-navy-900">Needs Attention</h2>
          </div>
          <span className="text-xs font-semibold text-rose-600">
            {highPriorityAlerts.length} urgent review{highPriorityAlerts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {highPriorityAlerts.length === 0 ? (
          <Card className="p-5 bg-white text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>No urgent alerts requiring immediate clinical attention. All assigned patients are stable.</span>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {highPriorityAlerts.map((alert) => {
              const patientName = getPatientName(alert.patient_id);
              const isAcknowledged = alert.status === 'acknowledged';

              return (
                <Card
                  key={alert.id}
                  className="p-4 bg-white border-l-4 border-l-rose-500 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-navy-900 truncate">{patientName}</span>
                      <Badge variant="error" size="sm">
                        High Priority
                      </Badge>
                      <Badge variant={isAcknowledged ? 'neutral' : 'warning'} size="sm">
                        {isAcknowledged ? 'Acknowledged' : 'New'}
                      </Badge>
                    </div>

                    <p className="text-xs text-rose-700 font-medium leading-relaxed">
                      {alert.reason}
                    </p>

                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Reported {formatTime(alert.created_at)}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => navigate(`/clinician/patients/${alert.patient_id}`)}
                    >
                      Review Alert
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── B. Pending Verification Requests ─────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-teal-calm" />
            <h2 className="text-base font-bold text-navy-900">Pending Verification</h2>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {pendingVerifications.length} awaiting sign-off
          </span>
        </div>

        {pendingVerifications.length === 0 ? (
          <Card className="p-5 bg-white text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-calm shrink-0" />
            <span>No recovery activity reports currently awaiting doctor review.</span>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {pendingVerifications.map((v) => {
              const patientName = getPatientName(v.patient_id);
              return (
                <Card
                  key={v.id}
                  className="p-4 bg-white border-l-4 border-l-teal-calm shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-navy-900 truncate">{patientName}</span>
                      <Badge variant="warning" size="sm">
                        Pending Review
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-700 font-medium">
                      Doctor-Verified Recovery Activity Report requested
                    </p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Submitted {formatTime(v.requested_at)}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => navigate('/clinician/verifications')}
                  >
                    Review Request
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── D. Recent Activity Stream ────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-bold text-navy-900">Recent Activity</h2>
          </div>
          <span className="text-xs text-slate-400">
            Across authorized patients
          </span>
        </div>

        {recentEvents.length === 0 ? (
          <Card className="p-6 bg-white text-center text-xs text-slate-400">
            No recent activity recorded yet.
          </Card>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft divide-y divide-slate-100 overflow-hidden">
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
                  ? 'bg-teal-light text-teal-calm'
                  : 'bg-blue-50 text-blue-600';

              return (
                <div
                  key={event.id}
                  onClick={() => navigate(`/clinician/patients/${event.patientId}`)}
                  className="p-3.5 sm:p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-navy-900 truncate">
                          {event.patientName}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          • {event.title}
                        </span>
                        {event.badge && (
                          <Badge variant="error" size="sm">
                            {event.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 truncate">
                        {event.detail}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      {formatTime(event.timestamp)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Link to Patients Directory */}
        <div className="pt-1 text-center">
          <button
            onClick={() => navigate('/clinician/patients')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-hover hover:text-navy-900 transition-colors"
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
