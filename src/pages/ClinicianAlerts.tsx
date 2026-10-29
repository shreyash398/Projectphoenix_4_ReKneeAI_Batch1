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
import { Button } from '../components/common/Button';
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

  const rulesSummary = getRulesSummary();

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Top Header */}
      <button
        onClick={() => navigate('/clinician')}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:text-on-surface hover:border-slate-300 transition-all shadow-sm"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Clinician Overview</span>
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold mb-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>Clinical Triage Queue</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">Active Clinical Alerts</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review patient threshold escalations, protocol deviations, and log clinical actions
          </p>
        </div>

        <button
          onClick={() => setShowRulesModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:border-slate-300 transition-all shadow-sm self-start sm:self-auto"
        >
          <Settings2 className="w-3.5 h-3.5 text-slate-500" />
          <span>Configured Rules</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
            categoryFilter === 'all'
              ? 'bg-on-surface text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All Alerts ({alerts.length})
        </button>
        <button
          onClick={() => setCategoryFilter('clinical_review')}
          className={`px-4 py-2 rounded-full font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            categoryFilter === 'clinical_review'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:border-rose-300'
          }`}
        >
          <span>Clinical Escalations ({alerts.filter((a) => a.category === 'clinical_review').length})</span>
        </button>
        <button
          onClick={() => setCategoryFilter('engagement')}
          className={`px-4 py-2 rounded-full font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            categoryFilter === 'engagement'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:border-primary'
          }`}
        >
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
        <div className="rounded-3xl text-center py-12 bg-white border border-slate-100 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)]">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h2 className="text-sm font-bold text-on-surface">All alerts cleared and reviewed</h2>
          <p className="text-xs text-slate-400 mt-1">
            No active alerts matching your selected triage filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredAlerts.map((alert) => {
            const auditActions = alertActionsMap[alert.id] || [];
            const isAuditExpanded = expandedAuditAlertId === alert.id;

            return (
              <div
                key={alert.id}
                className={`rounded-3xl p-5 bg-white border border-slate-100 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] hover:shadow-card transition-all border-l-4 ${
                  alert.category === 'clinical_review'
                    ? 'border-l-rose-500'
                    : 'border-l-primary'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      alert.severity === 'critical'
                        ? 'bg-rose-100 text-rose-800'
                        : alert.severity === 'urgent'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {alert.severity}
                    </span>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      alert.category === 'clinical_review'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {alert.category === 'clinical_review' ? 'Clinical Escalation' : 'Reminder'}
                    </span>

                    <span className="text-[11px] text-slate-400 font-medium">
                      {new Date(alert.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold self-start sm:self-auto ${
                    alert.status === 'new'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : alert.status === 'acknowledged'
                      ? 'bg-sky-50 text-sky-800 border border-sky-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}>
                    {alert.status === 'new'
                      ? 'New Alert'
                      : alert.status === 'acknowledged'
                      ? 'Acknowledged'
                      : 'Reviewed'}
                  </span>
                </div>

                <p className="text-xs sm:text-sm font-semibold text-on-surface mb-4 leading-relaxed">
                  {alert.reason}
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <div className="flex items-center gap-1.5 font-medium">
                      <User className="w-3.5 h-3.5 text-primary" />
                      <span>Assigned Patient</span>
                    </div>

                    {auditActions.length > 0 && (
                      <button
                        onClick={() =>
                          setExpandedAuditAlertId(isAuditExpanded ? null : alert.id)
                        }
                        className="text-primary hover:underline flex items-center gap-1 text-[11px] ml-2 font-semibold"
                      >
                        <History className="w-3 h-3" />
                        <span>Audit Log ({auditActions.length})</span>
                        {isAuditExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {alert.patient_id && (
                      <button
                        onClick={() => navigate(`/clinician/patients/${alert.patient_id}`)}
                        className="px-3.5 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                      >
                        Patient Chart
                      </button>
                    )}

                    {alert.status === 'new' && (
                      <button
                        onClick={() => handleAcknowledge(alert)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-slate-500" />
                        <span>Acknowledge</span>
                      </button>
                    )}

                    {alert.status !== 'reviewed' && alert.status !== 'closed' ? (
                      <button
                        onClick={() => {
                          setSelectedAlert(alert);
                          setActionNotes('');
                        }}
                        className="px-4 py-1.5 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold text-xs shadow-md shadow-primary/20 transition-all active:scale-95"
                      >
                        Review Alert
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Reviewed
                      </span>
                    )}
                  </div>
                </div>

                {/* Audit trail */}
                {isAuditExpanded && auditActions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50/80 p-3.5 rounded-2xl space-y-2 text-xs">
                    <p className="font-bold text-on-surface text-[11px]">
                      Clinical Action Audit Trail:
                    </p>
                    {auditActions.map((act) => (
                      <div key={act.id} className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span className="font-bold text-on-surface">{act.action}</span>
                          <span className="font-medium">
                            {new Date(act.created_at).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {act.notes && (
                          <p className="text-slate-600 text-[11px] mt-1 font-medium">{act.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  rule.category === 'clinical_review' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {rule.category}
                </span>
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
