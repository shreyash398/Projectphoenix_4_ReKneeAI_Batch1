// ReKnee AI - Clinician Alerts
// Clear clinical triage and review queue with full audit trail logging.

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  ArrowLeft,
  CheckCircle2,
  User,
  History,
  Settings2,
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

  const handleAcknowledge = async (alert: Alert) => {
    try {
      await repository.acknowledgeAlert(
        alert.id,
        activeProfile.id,
        'Clinician acknowledged alert.'
      );
      await loadAlerts();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

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
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Top Header */}
      <button
        onClick={() => navigate('/clinician')}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Clinician Dashboard</span>
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Clinician Alerts</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review patient alerts and clinical escalations.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowRulesModal(true)}
          icon={<Settings2 className="w-3.5 h-3.5" />}
        >
          Configured rules
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 text-xs">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
            categoryFilter === 'all'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          All alerts ({alerts.length})
        </button>
        <button
          onClick={() => setCategoryFilter('clinical_review')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
            categoryFilter === 'clinical_review'
              ? 'bg-rose-700 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>Clinical review ({alerts.filter((a) => a.category === 'clinical_review').length})</span>
        </button>
        <button
          onClick={() => setCategoryFilter('engagement')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
            categoryFilter === 'engagement'
              ? 'bg-teal-calm text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>Engagement reminders ({alerts.filter((a) => a.category === 'engagement').length})</span>
        </button>
      </div>

      {/* Alerts List */}
      {isLoading ? (
        <div className="space-y-3">
          <LoadingSkeleton lines={3} />
          <LoadingSkeleton lines={3} />
        </div>
      ) : filteredAlerts.length === 0 ? (
        <Card className="text-center py-10 bg-white">
          <CheckCircle2 className="w-8 h-8 text-status-success mx-auto mb-2" />
          <h2 className="text-sm font-bold text-navy-900">All alerts reviewed</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            No active alerts matching your filter.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const auditActions = alertActionsMap[alert.id] || [];
            const isAuditExpanded = expandedAuditAlertId === alert.id;

            return (
              <Card
                key={alert.id}
                className={`p-4 bg-white shadow-soft border-l-4 ${
                  alert.category === 'clinical_review'
                    ? 'border-l-rose-500'
                    : 'border-l-teal-calm'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={getSeverityBadgeVariant(alert.severity)} size="sm">
                      {alert.severity}
                    </Badge>

                    <Badge
                      variant={alert.category === 'clinical_review' ? 'error' : 'teal'}
                      size="sm"
                    >
                      {alert.category === 'clinical_review' ? 'Clinical escalation' : 'Reminder'}
                    </Badge>

                    <span className="text-[11px] text-slate-400">
                      {new Date(alert.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

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

                <p className="text-xs sm:text-sm font-semibold text-navy-900 mb-3">
                  {alert.reason}
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-teal-calm" />
                      <span>Patient record</span>
                    </div>

                    {auditActions.length > 0 && (
                      <button
                        onClick={() =>
                          setExpandedAuditAlertId(isAuditExpanded ? null : alert.id)
                        }
                        className="text-teal-calm hover:text-teal-hover flex items-center gap-1 text-[11px] ml-2 font-medium"
                      >
                        <History className="w-3 h-3" />
                        <span>Audit log ({auditActions.length})</span>
                        {isAuditExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {alert.patient_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/clinician/patients/${alert.patient_id}`)}
                      >
                        Patient chart
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
                      >
                        Review alert
                      </Button>
                    ) : (
                      <span className="text-[11px] text-status-success font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Reviewed
                      </span>
                    )}
                  </div>
                </div>

                {/* Audit trail */}
                {isAuditExpanded && auditActions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs">
                    <p className="font-semibold text-navy-900 text-[11px]">
                      Clinical Action Audit Trail:
                    </p>
                    {auditActions.map((act) => (
                      <div key={act.id} className="bg-white p-2 rounded border border-slate-200 text-xs">
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span className="font-semibold text-navy-900">{act.action}</span>
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
                          <p className="text-slate-600 text-[11px] mt-0.5">{act.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={Boolean(selectedAlert)}
        onClose={() => setSelectedAlert(null)}
        title="Review Alert"
      >
        {selectedAlert && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">Reason</span>
              <p className="text-xs font-semibold text-navy-900 mt-0.5">{selectedAlert.reason}</p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-navy-900 mb-1">
                Clinical Action Taken
              </label>
              <select
                value={actionChoice}
                onChange={(e) => setActionChoice(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value="Contacted Patient — Reviewed Symptoms">
                  Contacted Patient — Reviewed Symptoms
                </option>
                <option value="Adjusted Exercise Repetition Target">
                  Adjusted Exercise Repetition Target
                </option>
                <option value="Scheduled Follow-up Clinic Consultation">
                  Scheduled Follow-up Clinic Consultation
                </option>
                <option value="Clinically Assessed — Routine Fluctuation">
                  Clinically Assessed — Routine Fluctuation
                </option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-navy-900 mb-1">
                Review Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Enter notes..."
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedAlert(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={isSubmittingAction}
                onClick={handleReviewAction}
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Sign off review
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Configured Rules Modal */}
      <Modal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        title="Configured Escalation Rules"
      >
        <div className="space-y-3 text-xs max-h-96 overflow-y-auto">
          {[
            ...rulesSummary.clinicalRules.map((r) => ({ ...r, category: 'clinical_review' as const })),
            ...rulesSummary.engagementRules.map((r) => ({ ...r, category: 'engagement' as const })),
          ].map((rule) => (
            <div key={rule.id} className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-navy-900">{rule.name}</span>
                <Badge variant={rule.category === 'clinical_review' ? 'error' : 'teal'} size="sm">
                  {rule.category}
                </Badge>
              </div>
              <p className="text-slate-500 text-[11px]">{rule.description}</p>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default ClinicianAlerts;
