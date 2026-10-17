import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronRight,
  Stethoscope,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import { Profile, Alert, RecoveryPlan, SymptomCheckin, ExerciseSession } from '../types/database';

export const ClinicianDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [patients, setPatients] = useState<Profile[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [patientPlan, setPatientPlan] = useState<RecoveryPlan | null>(null);
  const [latestCheckin, setLatestCheckin] = useState<SymptomCheckin | null>(null);
  const [latestSession, setLatestSession] = useState<ExerciseSession | null>(null);

  useEffect(() => {
    const loadClinicianData = async () => {
      setIsLoading(true);
      try {
        const [authPatients, allAlerts] = await Promise.all([
          repository.getClinicianAuthorizedPatients(activeProfile.id),
          repository.getAlerts(),
        ]);
        setPatients(authPatients);
        setAlerts(allAlerts);

        if (authPatients.length > 0) {
          const firstPatientId = authPatients[0].id;
          const [plan, checkins, sessions] = await Promise.all([
            repository.getRecoveryPlan(firstPatientId),
            repository.getSymptomCheckins(firstPatientId),
            repository.getExerciseSessions(firstPatientId),
          ]);
          setPatientPlan(plan);
          if (checkins.length > 0) setLatestCheckin(checkins[0]);
          if (sessions.length > 0) setLatestSession(sessions[0]);
        }
      } catch (err) {
        console.error('Failed to load clinician dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadClinicianData();
  }, [activeProfile.id]);

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <LoadingSkeleton lines={2} />
        <LoadingSkeleton lines={5} />
      </div>
    );
  }

  const unreviewedAlerts = alerts.filter((a) => a.status === 'new');

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Clinician Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-teal-calm tracking-wide uppercase">
              Clinical Review Portal
            </span>
            <Badge variant="teal" size="sm" icon={<Stethoscope className="w-3 h-3" />}>
              Authorized Provider
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-900 tracking-tight mt-0.5">
            Patient Recovery Oversight
          </h1>
          <p className="text-xs sm:text-sm text-slate-muted mt-0.5">
            Reviewing assigned home-recovery patients, symptom alerts, and exercise compliance.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/clinician/alerts')}
          className="relative"
        >
          <span>Review Active Alerts</span>
          {unreviewedAlerts.length > 0 && (
            <span className="ml-2 px-1.5 py-0.2 bg-status-error text-white text-[10px] rounded-full font-bold">
              {unreviewedAlerts.length}
            </span>
          )}
        </Button>
      </div>

      {/* Clinical Alert Notice Banner if pending alerts */}
      {unreviewedAlerts.length > 0 && (
        <Card className="bg-amber-50/60 border-amber-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-navy-900">
                  {unreviewedAlerts.length} Actionable Alert{unreviewedAlerts.length > 1 ? 's' : ''} Awaiting Review
                </h3>
                <p className="text-xs text-slate-muted mt-0.5">
                  High-priority patient reports require clinical assessment and audit acknowledgement.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0"
              onClick={() => navigate('/clinician/alerts')}
            >
              Open Queue
            </Button>
          </div>
        </Card>
      )}

      {/* Authorized Patients List */}
      <div>
        <h2 className="text-xs font-bold text-slate-muted uppercase tracking-wider mb-2">
          Authorized Patient Roster ({patients.length})
        </h2>

        {patients.length === 0 ? (
          <Card>
            <p className="text-xs text-slate-muted text-center py-4">
              No patients assigned to your clinician account.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {patients.map((patient) => (
              <Card key={patient.id} className="p-4 hover:border-teal-calm/60 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-warm-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-navy-900 text-white flex items-center justify-center font-bold text-sm shadow-soft">
                      {patient.full_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-navy-900">{patient.full_name}</h3>
                      <p className="text-xs text-slate-muted">
                        Protocol: <span className="font-medium text-teal-calm">{patientPlan?.title || 'TKA Protocol'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="teal" size="sm">
                      Active Recovery
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/clinician/alerts')}
                      icon={<ChevronRight className="w-4 h-4" />}
                    >
                      Inspect Records
                    </Button>
                  </div>
                </div>

                {/* Patient Summary Snapshot */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
                  <div className="bg-warm-bg p-2.5 rounded-lg border border-warm-border">
                    <p className="text-[10px] text-slate-subtle uppercase font-semibold">Latest Reported Pain</p>
                    <p className="text-sm font-bold text-navy-900 mt-0.5">
                      {latestCheckin ? `${latestCheckin.pain_score}/10` : 'None logged'}
                    </p>
                    <p className="text-[11px] text-slate-muted truncate">
                      {latestCheckin?.notes || 'No symptoms noted'}
                    </p>
                  </div>

                  <div className="bg-warm-bg p-2.5 rounded-lg border border-warm-border">
                    <p className="text-[10px] text-slate-subtle uppercase font-semibold">Latest Exercise Practice</p>
                    <p className="text-sm font-bold text-navy-900 mt-0.5">
                      {latestSession ? `${latestSession.repetitions} reps (${latestSession.duration_seconds}s)` : 'None logged'}
                    </p>
                    <p className="text-[11px] text-teal-calm font-medium">
                      {latestSession?.measurement_mode}
                    </p>
                  </div>

                  <div className="bg-warm-bg p-2.5 rounded-lg border border-warm-border">
                    <p className="text-[10px] text-slate-subtle uppercase font-semibold">Review Status</p>
                    <p className="text-sm font-bold text-navy-900 mt-0.5">
                      {unreviewedAlerts.length > 0 ? (
                        <span className="text-status-warning font-semibold">Action Required</span>
                      ) : (
                        <span className="text-status-success font-semibold">Up to Date</span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-muted">
                      {unreviewedAlerts.length} active flag(s)
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Governance & Clinical Responsibility Footnote */}
      <div className="p-3 bg-warm-subtle rounded-xl border border-warm-border text-xs text-slate-muted leading-relaxed">
        <strong className="text-navy-900 font-semibold block mb-0.5">Clinical Responsibility & Governance:</strong>
        ReKnee AI automated rules and alert indicators are clinical decision-support prototypes. They do not replace formal clinical assessment or emergency protocols. Licensed clinicians remain responsible for all care decisions.
      </div>
    </div>
  );
};
