// ReKnee AI - Clinician Alerts & Review Engine UI
// Adheres strictly to 01_PRD.md, 04_DATABASE.md, 05_API.md, 10_DATABASE_BACKEND.md, 14_TESTING_QA.md, and 16_SECURITY_AUDIT.md
// Separates Clinical Escalation alerts from Engagement Reminders with full audit trail logging.

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BellRing,
  CheckCircle,
  Clock,
  ArrowLeft,
  FileCheck,
  CheckCircle2,
  User,
  ShieldAlert,
  CalendarHeart,
  History,
  Settings2,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge, BadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertCategory, AlertAction } from '../types/database';
import { getRulesSummary } from '../lib/alerts/alertConfig';

export const ClinicianAlerts: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertActionsMap, setAlertActionsMap] = useState<Record<string, AlertAction[]>>({});
  const [expandedAuditAlertId, setExpandedAuditAlertId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | AlertCategory>('all');
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);

  // Review modal state
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [actionChoice, setActionChoice] = useState<string>('Contacted Patient — Reviewed Symptoms');
  const [actionNotes, setActionNotes] = useState<string>('');
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const data = await repository.getAlerts();
      setAlerts(data);

      // Load audit actions for these alerts
      const actionsMap: Record<string, AlertAction[]> = {};
      await Promise.all(
        data.map(async (alert) => {
          const acts = await repository.getAlertActions(alert.id);
          if (acts.length > 0) {
            actionsMap[alert.id] = acts;
          }
        })
      );
      setAlertActionsMap(actionsMap);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [activeProfile.id]);

  // Quick Acknowledge Action
  const handleAcknowledge = async (alert: Alert) => {
    try {
      await repository.acknowledgeAlert(
        alert.id,
        activeProfile.id,
        'Clinician acknowledged receipt of alert and verified triage status.'
      );
      await loadAlerts();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  // Sign off & Review Follow-Up Action
  const handleReviewAction = async () => {
    if (!selectedAlert) return;
    setIsSubmittingAction(true);
    try {
      await repository.reviewAlert(
        selectedAlert.id,
        activeProfile.id,
        actionChoice,
        actionNotes.trim() || 'Reviewed and addressed by clinician.'
      );
      setSelectedAlert(null);
      setActionNotes('');
      await loadAlerts();
    } catch (err) {
      console.error('Failed to update alert:', err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (categoryFilter === 'all') return true;
    return a.category === categoryFilter;
  });

  const getSeverityBadgeVariant = (sev: Alert['severity']): BadgeVariant => {
    switch (sev) {
      case 'critical':
        return 'error';
      case 'urgent':
        return 'warning';
      case 'moderate':
        return 'engagement';
      default:
        return 'neutral';
    }
  };

  const rulesSummary = getRulesSummary();

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/clinician')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-muted hover:text-navy-900 transition-colors p-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Patients</span>
        </button>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowRulesModal(true)}
            icon={<Settings2 className="w-3.5 h-3.5" />}
          >
            Configured Rules
          </Button>

          <Badge variant="teal" icon={<BellRing className="w-3.5 h-3.5" />}>
            Deterministic Engine
          </Badge>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-navy-900">Review & Escalation Queue</h1>
          <p className="text-xs text-slate-muted mt-0.5">
            Rule-based alerts with complete separation between clinical escalations and engagement reminders.
          </p>
        </div>
      </div>

      {/* Safety & Protocol Banner */}
      <div className="bg-warm-subtle/80 border border-warm-border rounded-xl p-3 text-xs text-slate-muted flex items-start gap-2.5 shadow-soft">
        <Info className="w-4 h-4 text-teal-calm shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-navy-900 font-semibold">
            Separation of Concerns: Clinical Review vs Engagement
          </p>
          <p>
            Clinical alerts require explicit configured rule matches. Missed exercise sessions are friendly engagement notices, <strong>never</strong> marked as medical emergencies. No LLM is used in alert escalation decisions.
          </p>
        </div>
      </div>

      {/* Filter Tabs: Clinical Review vs Engagement */}
      <div className="flex gap-2 border-b border-warm-border pb-2 text-xs">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            categoryFilter === 'all'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-muted hover:bg-warm-subtle'
          }`}
        >
          All Alerts ({alerts.length})
        </button>
        <button
          onClick={() => setCategoryFilter('clinical_review')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
            categoryFilter === 'clinical_review'
              ? 'bg-rose-700 text-white'
              : 'bg-white text-slate-muted hover:bg-warm-subtle'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Clinical Review ({alerts.filter((a) => a.category === 'clinical_review').length})</span>
        </button>
        <button
          onClick={() => setCategoryFilter('engagement')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
            categoryFilter === 'engagement'
              ? 'bg-teal-calm text-white'
              : 'bg-white text-slate-muted hover:bg-warm-subtle'
          }`}
        >
          <CalendarHeart className="w-3.5 h-3.5" />
          <span>Engagement Reminders ({alerts.filter((a) => a.category === 'engagement').length})</span>
        </button>
      </div>

      {/* Alerts List */}
      {isLoading ? (
        <div className="space-y-3">
          <LoadingSkeleton lines={3} />
          <LoadingSkeleton lines={3} />
        </div>
      ) : filteredAlerts.length === 0 ? (
        <Card className="text-center py-10">
          <CheckCircle2 className="w-10 h-10 text-status-success mx-auto mb-2" />
          <h3 className="text-sm font-bold text-navy-900">All Caught Up!</h3>
          <p className="text-xs text-slate-muted mt-0.5">
            No active alerts matching your filter criteria.
          </p>
        </Card>
      ) : (
        <div className="space-y-3.5">
          {filteredAlerts.map((alert) => {
            const auditActions = alertActionsMap[alert.id] || [];
            const isAuditExpanded = expandedAuditAlertId === alert.id;

            return (
              <Card
                key={alert.id}
                className={`p-4 transition-all shadow-soft border ${
                  alert.category === 'engagement'
                    ? 'border-l-4 border-l-teal-calm bg-teal-50/10'
                    : alert.severity === 'critical'
                    ? 'border-l-4 border-l-rose-500 bg-rose-50/20'
                    : alert.severity === 'urgent'
                    ? 'border-l-4 border-l-amber-500 bg-amber-50/20'
                    : 'border-l-4 border-l-blue-400 bg-white'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={getSeverityBadgeVariant(alert.severity)} size="sm">
                      {alert.severity.toUpperCase()}
                    </Badge>

                    <Badge
                      variant={alert.category === 'clinical_review' ? 'error' : 'teal'}
                      size="sm"
                    >
                      {alert.category === 'clinical_review' ? 'Clinical Escalation' : 'Engagement Reminder'}
                    </Badge>

                    <span className="text-[11px] font-semibold text-slate-subtle uppercase">
                      Source: {alert.source_type.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-muted">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {new Date(alert.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <Badge
                      variant={
                        alert.status === 'new'
                          ? 'warning'
                          : alert.status === 'acknowledged'
                          ? 'engagement'
                          : 'success'
                      }
                      size="sm"
                    >
                      {alert.status === 'new'
                        ? 'New'
                        : alert.status === 'acknowledged'
                        ? 'Acknowledged'
                        : 'Reviewed'}
                    </Badge>
                  </div>
                </div>

                {/* Alert Reason */}
                <p className="text-xs sm:text-sm font-semibold text-navy-900 mb-3 leading-relaxed">
                  {alert.reason}
                </p>

                {/* Footer Bar with Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-warm-border/80">
                  <div className="text-[11px] text-slate-muted flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-teal-calm" />
                      <span>Patient: <strong>Eleanor Vance</strong></span>
                    </div>

                    {auditActions.length > 0 && (
                      <button
                        onClick={() =>
                          setExpandedAuditAlertId(isAuditExpanded ? null : alert.id)
                        }
                        className="text-teal-calm hover:text-teal-hover flex items-center gap-1 text-[11px] ml-2 font-medium"
                      >
                        <History className="w-3 h-3" />
                        <span>Audit Trail ({auditActions.length})</span>
                        {isAuditExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Clinician Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {alert.patient_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/clinician/patients/${alert.patient_id}`)}
                      >
                        Review Patient
                      </Button>
                    )}

                    {alert.status === 'new' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAcknowledge(alert)}
                        icon={<CheckCircle className="w-3.5 h-3.5" />}
                      >
                        Acknowledge
                      </Button>
                    )}

                    {alert.status !== 'reviewed' && alert.status !== 'closed' ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          setSelectedAlert(alert);
                          setActionNotes('');
                        }}
                        icon={<FileCheck className="w-3.5 h-3.5" />}
                      >
                        Review Alert
                      </Button>
                    ) : (
                      <span className="text-[11px] text-status-success font-semibold flex items-center gap-1 py-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Reviewed by Clinician
                      </span>
                    )}
                  </div>
                </div>

                {/* Expandable Audit Trail History */}
                {isAuditExpanded && auditActions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-warm-border bg-warm-bg/70 p-3 rounded-xl space-y-2 text-xs animate-fadeIn">
                    <p className="font-semibold text-navy-900 flex items-center gap-1.5 text-[11px]">
                      <History className="w-3.5 h-3.5 text-teal-calm" />
                      <span>Clinical Action Audit Trail:</span>
                    </p>
                    <div className="space-y-1.5">
                      {auditActions.map((act) => (
                        <div
                          key={act.id}
                          className="bg-white p-2.5 rounded-lg border border-warm-border/80 text-xs"
                        >
                          <div className="flex justify-between items-center text-[10px] text-slate-subtle mb-1">
                            <span className="font-semibold text-navy-900">
                              {act.action}
                            </span>
                            <span>
                              {new Date(act.created_at).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          {act.notes && (
                            <p className="text-slate-muted text-[11px] mt-0.5">
                              {act.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Review & Action Modal */}
      <Modal
        isOpen={Boolean(selectedAlert)}
        onClose={() => setSelectedAlert(null)}
        title="Clinician Alert Review & Action Sign-Off"
      >
        {selectedAlert && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-warm-bg border border-warm-border text-xs text-navy-900">
              <span className="text-[10px] text-slate-subtle uppercase font-semibold block mb-0.5">
                Triggered Alert Reason:
              </span>
              <p className="font-semibold text-navy-900">{selectedAlert.reason}</p>
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-warm-border/80 text-[10px] text-slate-subtle">
                <span>Category: <strong>{selectedAlert.category}</strong></span>
                <span>•</span>
                <span>Severity: <strong>{selectedAlert.severity}</strong></span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block mb-1.5">
                Clinical Follow-Up Action Taken
              </label>
              <select
                value={actionChoice}
                onChange={(e) => setActionChoice(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-warm-border focus:border-teal-calm bg-white text-navy-900"
              >
                <option value="Contacted Patient — Reviewed Symptoms & Advised Ice/Elevation">
                  Contacted Patient — Reviewed Symptoms & Advised Ice/Elevation
                </option>
                <option value="Telehealth Consultation Scheduled for In-depth Mobility Exam">
                  Telehealth Consultation Scheduled for In-depth Mobility Exam
                </option>
                <option value="Directed to Emergency / Urgent Evaluation (DVT Precaution)">
                  Directed to Emergency / Urgent Evaluation (DVT Precaution)
                </option>
                <option value="Re-evaluated Exercise Protocol — Adjusted Targets">
                  Re-evaluated Exercise Protocol — Adjusted Targets
                </option>
                <option value="Cleared for Continued Rehabilitation Protocol">
                  Cleared for Continued Rehabilitation Protocol
                </option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block mb-1">
                Clinical Action Notes & Audit Documentation
              </label>
              <textarea
                rows={3}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Document clinical rationale, specific instructions given to patient, or follow-up plan..."
                className="w-full text-xs p-2.5 rounded-lg border border-warm-border focus:border-teal-calm bg-white text-navy-900 resize-none placeholder:text-slate-subtle"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <Button
                variant="outline"
                fullWidth
                onClick={() => setSelectedAlert(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                fullWidth
                isLoading={isSubmittingAction}
                onClick={handleReviewAction}
              >
                Sign Off & Close Alert
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Transparent Rules Summary Modal */}
      <Modal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        title="Configured Clinical & Engagement Rules"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto text-xs pr-1">
          <p className="text-slate-muted leading-relaxed">
            All alerts are evaluated deterministically from these explicit configurations. Medical thresholds can be customized and audited by clinical leadership.
          </p>

          <div className="space-y-2">
            <h4 className="font-bold text-navy-900 flex items-center gap-1.5 text-xs uppercase tracking-wider text-rose-700">
              <ShieldAlert className="w-4 h-4" />
              <span>1. Clinical Escalation Rules ({rulesSummary.clinicalRules.length})</span>
            </h4>
            <div className="space-y-2">
              {rulesSummary.clinicalRules.map((r) => (
                <div
                  key={r.id}
                  className="p-2.5 rounded-lg bg-warm-bg border border-warm-border text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-navy-900">
                      [{r.id}] {r.name}
                    </span>
                    <Badge variant={getSeverityBadgeVariant(r.severity as Alert['severity'])} size="sm">
                      {r.severity}
                    </Badge>
                  </div>
                  <p className="text-slate-muted text-[11px]">{r.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-warm-border">
            <h4 className="font-bold text-navy-900 flex items-center gap-1.5 text-xs uppercase tracking-wider text-teal-calm">
              <CalendarHeart className="w-4 h-4" />
              <span>2. Engagement Reminder Rules ({rulesSummary.engagementRules.length})</span>
            </h4>
            <div className="space-y-2">
              {rulesSummary.engagementRules.map((r) => (
                <div
                  key={r.id}
                  className="p-2.5 rounded-lg bg-warm-bg border border-warm-border text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-navy-900">
                      [{r.id}] {r.name}
                    </span>
                    <Badge variant="teal" size="sm">
                      {r.severity}
                    </Badge>
                  </div>
                  <p className="text-slate-muted text-[11px]">{r.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <Button variant="outline" fullWidth onClick={() => setShowRulesModal(false)}>
              Close Protocol Reference
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
