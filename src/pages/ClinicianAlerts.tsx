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
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge, BadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertCategory } from '../types/database';

export const ClinicianAlerts: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<'all' | AlertCategory>('all');

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
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [activeProfile.id]);

  const handleReviewAction = async () => {
    if (!selectedAlert) return;
    setIsSubmittingAction(true);
    try {
      await repository.updateAlertStatus(
        selectedAlert.id,
        'reviewed',
        activeProfile.id,
        actionChoice,
        actionNotes
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

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/clinician')}
          className="flex items-center gap-1 text-xs font-semibold text-slate-muted hover:text-navy-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Patients</span>
        </button>

        <Badge variant="teal" icon={<BellRing className="w-3.5 h-3.5" />}>
          Clinical Alert Queue
        </Badge>
      </div>

      <div>
        <h1 className="text-xl font-bold text-navy-900">Review & Escalation Queue</h1>
        <p className="text-xs text-slate-muted mt-0.5">
          Deterministic alerts generated from patient daily check-ins and recovery milestones.
        </p>
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
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            categoryFilter === 'clinical_review'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-muted hover:bg-warm-subtle'
          }`}
        >
          Clinical Review ({alerts.filter((a) => a.category === 'clinical_review').length})
        </button>
        <button
          onClick={() => setCategoryFilter('engagement')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            categoryFilter === 'engagement'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-muted hover:bg-warm-subtle'
          }`}
        >
          Engagement Reminders ({alerts.filter((a) => a.category === 'engagement').length})
        </button>
      </div>

      {/* Alerts List */}
      {isLoading ? (
        <div className="space-y-3">
          <LoadingSkeleton lines={3} />
          <LoadingSkeleton lines={3} />
        </div>
      ) : filteredAlerts.length === 0 ? (
        <Card className="text-center py-8">
          <CheckCircle2 className="w-10 h-10 text-status-success mx-auto mb-2" />
          <h3 className="text-sm font-bold text-navy-900">All Caught Up!</h3>
          <p className="text-xs text-slate-muted mt-0.5">
            No active alerts matching your filter criteria.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <Card
              key={alert.id}
              className={`p-4 transition-all ${
                alert.status === 'new'
                  ? 'border-l-4 border-l-status-warning bg-amber-50/20'
                  : 'bg-white opacity-85'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant={getSeverityBadgeVariant(alert.severity)} size="sm">
                    {alert.severity.toUpperCase()}
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
                    variant={alert.status === 'new' ? 'warning' : 'success'}
                    size="sm"
                  >
                    {alert.status === 'new' ? 'Needs Review' : 'Reviewed'}
                  </Badge>
                </div>
              </div>

              {/* Alert Content */}
              <p className="text-xs sm:text-sm font-medium text-navy-900 mb-3 leading-relaxed">
                {alert.reason}
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-warm-border/80">
                <div className="text-[11px] text-slate-muted flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-teal-calm" />
                  <span>Patient: <strong>Eleanor Vance (TKA Day 14)</strong></span>
                </div>

                {alert.status === 'new' ? (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setSelectedAlert(alert);
                      setActionNotes('');
                    }}
                    icon={<FileCheck className="w-4 h-4" />}
                  >
                    Review & Take Action
                  </Button>
                ) : (
                  <span className="text-[11px] text-status-success font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Reviewed by Clinician
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Review & Action Modal */}
      <Modal
        isOpen={Boolean(selectedAlert)}
        onClose={() => setSelectedAlert(null)}
        title="Clinician Alert Review & Audit Action"
      >
        {selectedAlert && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-warm-bg border border-warm-border text-xs text-navy-900">
              <span className="text-[10px] text-slate-subtle uppercase font-semibold block mb-0.5">
                Trigger Reason:
              </span>
              <p className="font-medium">{selectedAlert.reason}</p>
            </div>

            <div>
              <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block mb-1.5">
                Clinical Action Taken
              </label>
              <select
                value={actionChoice}
                onChange={(e) => setActionChoice(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-warm-border focus:border-teal-calm bg-white text-navy-900"
              >
                <option value="Contacted Patient — Reviewed Symptoms">
                  Contacted Patient — Reviewed Symptoms & Advised Ice/Elevation
                </option>
                <option value="Telehealth Consultation Scheduled">
                  Telehealth Consultation Scheduled for In-depth Mobility Exam
                </option>
                <option value="Directed to Emergency / Urgent Evaluation">
                  Directed to Emergency / Urgent Evaluation (DVT / PE precaution)
                </option>
                <option value="Re-evaluated & Cleared for Continued Protocol">
                  Re-evaluated & Cleared for Continued Protocol
                </option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block mb-1">
                Clinical Notes & Audit Trail (Required)
              </label>
              <textarea
                rows={3}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Document clinical rationale, instructions provided to patient, or follow-up plan..."
                className="w-full text-xs p-2.5 rounded-lg border border-warm-border focus:border-teal-calm bg-white text-navy-900 resize-none"
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
    </div>
  );
};
