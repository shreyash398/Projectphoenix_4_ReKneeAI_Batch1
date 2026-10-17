// ReKnee AI — Daily Recovery Check-in
// Patients record pain score, structured symptoms, and optional notes.
// Configurable deterministic alert rules create review signals without diagnosis.

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  CheckCircle2,
  Send,
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  Phone,
  ChevronDown,
  ChevronUp,
  History,
  Info,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import { evaluateCheckinAlert } from '../lib/alerts/rules';
import { SymptomCheckin } from '../types/database';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SymptomField {
  key: string;
  label: string;
  description: string;
  tier: 'routine' | 'watch' | 'urgent';
}

interface FormState {
  painScore: number;
  swelling: boolean;
  warmth: boolean;
  redness: boolean;
  stiffness: boolean;
  numbness: boolean;
  calfPain: boolean;
  fever: boolean;
  chestPain: boolean;
  notes: string;
}

interface FormErrors {
  painScore?: string;
  notes?: string;
  general?: string;
}

// ─── Configuration ────────────────────────────────────────────────────────────
// Clinical field configuration — transparent and independent of UI logic.
// Thresholds here are illustrative for demonstration; require clinical approval for production.

const SYMPTOM_FIELDS: SymptomField[] = [
  {
    key: 'stiffness',
    label: 'Morning joint stiffness',
    description: 'Common in early post-op weeks, typically eases with gentle movement',
    tier: 'routine',
  },
  {
    key: 'swelling',
    label: 'Puffiness or swelling around the knee',
    description: 'Can be managed with elevation and 15-minute ice packs as instructed',
    tier: 'routine',
  },
  {
    key: 'warmth',
    label: 'Localized warmth to the touch',
    description: 'Mild warmth around the joint is common in the post-operative period',
    tier: 'routine',
  },
  {
    key: 'numbness',
    label: 'Numbness or tingling around the incision',
    description: 'Nerve sensory recovery can take months and is frequently reported',
    tier: 'routine',
  },
  {
    key: 'redness',
    label: 'Spreading redness beyond the incision perimeter',
    description: 'Wound healing watch signal — your care team may want to review',
    tier: 'watch',
  },
  {
    key: 'fever',
    label: 'Oral fever ≥ 100.4 °F (38 °C)',
    description: 'Infection watch signal — note onset time in your notes',
    tier: 'watch',
  },
  {
    key: 'calfPain',
    label: 'New calf pain or cramping tightness',
    description: 'Important DVT (blood-clot) precaution metric — report to your care team',
    tier: 'urgent',
  },
  {
    key: 'chestPain',
    label: 'Chest pain or difficulty breathing',
    description: 'Requires immediate emergency evaluation — do not wait',
    tier: 'urgent',
  },
];

const PAIN_DESCRIPTORS: Record<number, string> = {
  0: 'No pain at all',
  1: 'Very mild — barely noticeable',
  2: 'Mild discomfort — can ignore with focus',
  3: 'Mild — noticeably uncomfortable but manageable',
  4: 'Moderate — interferes with some activities',
  5: 'Moderate — affects most activities',
  6: 'Moderate–severe — noticeably limits daily function',
  7: 'Severe — makes most activities very difficult',
  8: 'Very severe — constant significant pain',
  9: 'Extremely severe — unable to perform normal activities',
  10: 'Worst imaginable — complete incapacitation',
};

const NOTES_MAX = 500;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPainTier(score: number): { color: string; bg: string; border: string } {
  if (score === 0) return { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (score <= 3) return { color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' };
  if (score <= 6) return { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
  if (score <= 8) return { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' };
  return { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isSameDay(isoA: string, isoB: string): boolean {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getSymptomNames(symptoms: Record<string, boolean>): string[] {
  const labelMap: Record<string, string> = {
    stiffness: 'Joint stiffness',
    swelling: 'Swelling',
    warmth: 'Localized warmth',
    numbness: 'Numbness/tingling',
    redness: 'Redness',
    fever: 'Fever',
    calf_pain: 'Calf pain',
    chest_pain_shortness_breath: 'Chest pain',
  };
  return Object.keys(symptoms)
    .filter((k) => symptoms[k])
    .map((k) => labelMap[k] || k);
}

function buildInitialForm(): FormState {
  return {
    painScore: 3,
    swelling: false,
    warmth: false,
    redness: false,
    stiffness: false,
    numbness: false,
    calfPain: false,
    fever: false,
    chestPain: false,
    notes: '',
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const PainScaleCard: React.FC<{
  value: number;
  onChange: (v: number) => void;
  error?: string;
}> = ({ value, onChange, error }) => {
  const tier = getPainTier(value);

  return (
    <Card>
      <div className="flex items-start justify-between mb-2 gap-2">
        <div>
          <label
            htmlFor="pain-slider"
            className="text-xs font-bold text-navy-900 uppercase tracking-wider"
          >
            Step 1 — Knee Pain Level
          </label>
          <p className="text-[11px] text-slate-muted mt-0.5">
            Rate your pain right now, from 0 (none) to 10 (worst imaginable)
          </p>
        </div>
        <span
          className={`text-sm font-bold px-3 py-1 rounded-full flex-shrink-0 border ${tier.bg} ${tier.color} ${tier.border}`}
          aria-live="polite"
        >
          {value} / 10
        </span>
      </div>

      {/* Visual pain bar */}
      <div className="relative mb-4 pt-1">
        <input
          id="pain-slider"
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="w-full h-3 rounded-lg appearance-none cursor-pointer accent-teal-calm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-calm"
          aria-valuemin={0}
          aria-valuemax={10}
          aria-valuenow={value}
          aria-label="Pain scale 0 to 10"
        />
        <div className="flex justify-between text-[10px] text-slate-subtle mt-2 font-medium select-none">
          <span>0 – None</span>
          <span>3 – Mild</span>
          <span>5 – Moderate</span>
          <span>8 – Severe</span>
          <span>10 – Worst</span>
        </div>
      </div>

      {/* Descriptor */}
      <p className={`text-xs font-medium px-3 py-2 rounded-lg ${tier.bg} ${tier.color}`}>
        {PAIN_DESCRIPTORS[value]}
      </p>

      {/* High-pain advisory (not a diagnosis) */}
      {value >= 8 && (
        <div className="mt-3 flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-800">
            Your score is in the severe range. Your care team may be notified to review your
            recovery. Please contact your care team if you are concerned.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-status-error font-medium" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
};

const SymptomCheckbox: React.FC<{
  field: SymptomField;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ field, checked, onChange }) => {
  const tierStyles = {
    routine: {
      border: 'border-warm-border hover:bg-warm-subtle/50',
      checkClass: 'text-teal-calm focus:ring-teal-calm border-warm-border',
      bg: '',
    },
    watch: {
      border: 'border-amber-200 bg-amber-50/30 hover:bg-amber-50/60',
      checkClass: 'text-amber-600 focus:ring-amber-500 border-amber-300',
      bg: '',
    },
    urgent: {
      border: 'border-red-200 bg-rose-50/30 hover:bg-rose-50/60',
      checkClass: 'text-rose-600 focus:ring-rose-500 border-rose-300',
      bg: '',
    },
  };

  const s = tierStyles[field.tier];

  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${s.border}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`w-4.5 h-4.5 mt-0.5 flex-shrink-0 rounded ${s.checkClass} transition-colors`}
      />
      <div className="text-xs leading-snug">
        <span className="font-semibold text-navy-900 flex items-center gap-1.5 flex-wrap">
          {field.label}
          {field.tier === 'watch' && (
            <Badge variant="warning" size="sm">
              Care team may review
            </Badge>
          )}
          {field.tier === 'urgent' && (
            <Badge variant="error" size="sm">
              {field.key === 'chestPain' ? 'Emergency signal' : 'Clinician review'}
            </Badge>
          )}
        </span>
        <span className="text-slate-muted text-[11px] mt-0.5 block">{field.description}</span>
      </div>
    </label>
  );
};

const CheckinHistoryItem: React.FC<{
  checkin: SymptomCheckin;
  isFirst?: boolean;
}> = ({ checkin, isFirst }) => {
  const [expanded, setExpanded] = useState(isFirst);
  const tier = getPainTier(checkin.pain_score);
  const symptoms = getSymptomNames(checkin.symptoms as Record<string, boolean>);

  return (
    <Card className="py-3 px-4">
      <button
        className="w-full flex items-center justify-between text-left gap-2"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`text-sm font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${tier.bg} ${tier.color}`}
          >
            {checkin.pain_score}/10
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-navy-900 truncate">
              {formatDate(checkin.created_at)}
            </p>
            <p className="text-[11px] text-slate-muted">
              {symptoms.length > 0 ? `${symptoms.length} symptom${symptoms.length !== 1 ? 's' : ''} noted` : 'No symptoms selected'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {checkin.pain_score >= 8 && <Badge variant="warning" size="sm">Elevated</Badge>}
          {checkin.pain_score <= 3 && <Badge variant="success" size="sm">Controlled</Badge>}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-muted" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-warm-border space-y-2">
          {symptoms.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {symptoms.map((s) => (
                <span
                  key={s}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-warm-subtle border border-warm-border text-navy-900 font-medium"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-subtle italic">No symptoms selected</p>
          )}
          {checkin.notes && (
            <p className="text-[11px] text-slate-muted italic border-l-2 border-warm-border pl-2">
              "{checkin.notes}"
            </p>
          )}
        </div>
      )}
    </Card>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const DailyCheckin: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

  // History loading state
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [previousCheckins, setPreviousCheckins] = useState<SymptomCheckin[]>([]);

  // Form state
  const [form, setForm] = useState<FormState>(buildInitialForm());
  const [errors, setErrors] = useState<FormErrors>({});

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedCheckin, setSubmittedCheckin] = useState<SymptomCheckin | null>(null);
  const [alertTriggered, setAlertTriggered] = useState(false);

  // Emergency modal
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadCheckins = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const list = await repository.getSymptomCheckins(activeProfile.id);
      setPreviousCheckins(list);
    } catch (err) {
      setHistoryError('Unable to load previous check-ins. Please try again.');
    } finally {
      setHistoryLoading(false);
    }
  }, [activeProfile.id]);

  useEffect(() => {
    loadCheckins();
  }, [loadCheckins]);

  // ── Today's status ────────────────────────────────────────────────────────

  const todayIso = new Date().toISOString();
  const todaysCheckin =
    submittedCheckin ??
    previousCheckins.find((c) => isSameDay(c.created_at, todayIso)) ??
    null;

  // ── Form helpers ──────────────────────────────────────────────────────────

  const setSymptom = (key: keyof FormState, val: boolean) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const getSymptomValue = (key: string): boolean => {
    const map: Record<string, keyof FormState> = {
      stiffness: 'stiffness',
      swelling: 'swelling',
      warmth: 'warmth',
      numbness: 'numbness',
      redness: 'redness',
      fever: 'fever',
      calfPain: 'calfPain',
      chestPain: 'chestPain',
    };
    const formKey = map[key];
    return formKey ? !!(form[formKey] as boolean) : false;
  };

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (form.painScore < 0 || form.painScore > 10 || !Number.isInteger(form.painScore)) {
      errs.painScore = 'Pain score must be a whole number between 0 and 10.';
    }
    if (form.notes.length > NOTES_MAX) {
      errs.notes = `Notes must not exceed ${NOTES_MAX} characters.`;
    }
    return errs;
  }

  // ── Submission ────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Chest-pain emergency interception
    if (form.chestPain) {
      setShowEmergencyModal(true);
      return;
    }

    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const checkinData: Omit<SymptomCheckin, 'id' | 'created_at'> = {
        patient_id: activeProfile.id,
        pain_score: form.painScore,
        symptoms: {
          stiffness: form.stiffness,
          swelling: form.swelling,
          warmth: form.warmth,
          numbness: form.numbness,
          redness: form.redness,
          fever: form.fever,
          calf_pain: form.calfPain,
          chest_pain_shortness_breath: form.chestPain,
        },
        notes: form.notes.slice(0, NOTES_MAX).trim(),
      };

      // Pre-evaluate alert so we can notify the patient immediately
      const alertResult = evaluateCheckinAlert({
        ...checkinData,
        symptoms: checkinData.symptoms as Record<string, boolean>,
        id: '__preview__',
        created_at: new Date().toISOString(),
      });

      const saved = await repository.saveSymptomCheckin(checkinData);
      setSubmittedCheckin(saved);
      setAlertTriggered(alertResult.shouldAlert && alertResult.category === 'clinical_review');

      // Refresh history
      const updated = await repository.getSymptomCheckins(activeProfile.id);
      setPreviousCheckins(updated);
    } catch (err) {
      setSubmitError(
        'Your check-in could not be saved. Your answers have been preserved — please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const renderSuccessState = () => {
    if (!todaysCheckin) return null;
    const tier = getPainTier(todaysCheckin.pain_score);

    return (
      <div className="space-y-4">
        {/* Success card */}
        <Card className="text-center py-8 space-y-4 border-emerald-200 bg-emerald-50/30">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-navy-900">Today's Check-in Recorded</h2>
            <p className="text-xs text-slate-muted max-w-xs mx-auto mt-1">
              Your pain score of{' '}
              <span className={`font-semibold ${tier.color}`}>
                {todaysCheckin.pain_score}/10
              </span>{' '}
              and reported symptoms have been saved to your recovery record.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-2 pt-1 px-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSubmittedCheckin(null);
                setForm(buildInitialForm());
                setErrors({});
                setAlertTriggered(false);
              }}
            >
              Update Today's Check-in
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/')}>
              Return to Home
            </Button>
          </div>
        </Card>

        {/* Clinical alert notice — not a diagnosis */}
        {alertTriggered && (
          <div
            className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl"
            role="alert"
          >
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 space-y-1">
              <p className="font-semibold">Your care team has been notified</p>
              <p>
                Based on your check-in responses, a configured review signal has been sent to
                your clinician. This is not a diagnosis — your care team will review the record
                and follow up as needed.
              </p>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="flex items-start gap-2 p-3 bg-warm-subtle/60 border border-warm-border rounded-lg">
          <Info className="w-4 h-4 text-slate-muted flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-muted leading-relaxed">
            This app does not diagnose conditions. For urgent concerns, contact your care team
            directly or call emergency services.
          </p>
        </div>
      </div>
    );
  };

  const renderForm = () => (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Already-today notice */}
      {todaysCheckin && !submittedCheckin && (
        <div className="flex items-start gap-2 p-3 bg-teal-50 border border-teal-200 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-teal-800">
            You already submitted a check-in today (Pain: {todaysCheckin.pain_score}/10). You
            may update it below.
          </p>
        </div>
      )}

      {/* Pain Scale */}
      <PainScaleCard
        value={form.painScore}
        onChange={(v) => setForm((prev) => ({ ...prev, painScore: v }))}
        error={errors.painScore}
      />

      {/* Symptom Selection */}
      <Card>
        <div className="mb-4">
          <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
            Step 2 — Symptoms Today
          </h3>
          <p className="text-[11px] text-slate-muted mt-1">
            Select all sensations you have experienced around your knee or leg today.
            Selecting nothing is a valid response.
          </p>
        </div>

        <div className="space-y-2">
          {SYMPTOM_FIELDS.map((field) => (
            <SymptomCheckbox
              key={field.key}
              field={field}
              checked={getSymptomValue(field.key)}
              onChange={(v) => setSymptom(field.key as keyof FormState, v)}
            />
          ))}
        </div>
      </Card>

      {/* Notes */}
      <Card>
        <label
          htmlFor="notes-field"
          className="text-xs font-bold text-navy-900 uppercase tracking-wider block mb-1"
        >
          Step 3 — Notes (Optional)
        </label>
        <p className="text-[11px] text-slate-muted mb-3">
          Any observations for your physical therapist or care team today.
        </p>
        <textarea
          id="notes-field"
          rows={3}
          maxLength={NOTES_MAX}
          placeholder="e.g. Completed morning walk comfortably; knee felt tighter around 4 PM..."
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          className={`w-full text-xs p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-calm bg-warm-bg/40 resize-none text-navy-900 leading-relaxed ${
            errors.notes ? 'border-status-error' : 'border-warm-border focus:border-teal-calm'
          }`}
          aria-describedby="notes-hint"
        />
        <div id="notes-hint" className="flex justify-between text-[11px] text-slate-subtle mt-1.5">
          <span>Do not include passwords, account numbers, or unrelated personal data.</span>
          <span className={form.notes.length > NOTES_MAX * 0.9 ? 'text-amber-600 font-semibold' : ''}>
            {form.notes.length}/{NOTES_MAX}
          </span>
        </div>
        {errors.notes && (
          <p className="mt-1 text-xs text-status-error font-medium" role="alert">
            {errors.notes}
          </p>
        )}
      </Card>

      {/* Submit error */}
      {submitError && (
        <div
          className="flex items-start gap-2 p-3 bg-status-error-bg border border-red-200 rounded-xl"
          role="alert"
        >
          <AlertTriangle className="w-4 h-4 text-status-error flex-shrink-0 mt-0.5" />
          <p className="text-xs text-status-error">{submitError}</p>
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        fullWidth
        size="lg"
        isLoading={isSubmitting}
        icon={<Send className="w-4 h-4" />}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Saving Check-in…' : 'Submit Daily Check-in'}
      </Button>

      {/* Safety note */}
      <p className="text-center text-[11px] text-slate-subtle px-4">
        This check-in helps your care team monitor your recovery. It does not replace your
        clinical appointments.
      </p>
    </form>
  );

  const renderHistory = () => {
    if (historyLoading) {
      return (
        <div className="space-y-2">
          <LoadingSkeleton lines={2} />
          <LoadingSkeleton lines={2} />
        </div>
      );
    }

    if (historyError) {
      return <ErrorState message={historyError} onRetry={loadCheckins} />;
    }

    const recentHistory = previousCheckins.slice(0, 5);

    if (recentHistory.length === 0) {
      return (
        <EmptyState
          title="No previous check-ins"
          description="Your submitted check-ins will appear here. Complete today's check-in above to get started."
          icon={<History className="w-6 h-6 text-teal-calm" />}
        />
      );
    }

    return (
      <div className="space-y-2">
        {recentHistory.map((chk, i) => (
          <CheckinHistoryItem key={chk.id} checkin={chk} isFirst={i === 0} />
        ))}
        {previousCheckins.length > 5 && (
          <p className="text-center text-[11px] text-slate-muted pt-1">
            Showing 5 most recent check-ins. View full history in{' '}
            <button
              onClick={() => navigate('/progress')}
              className="underline text-teal-calm hover:text-teal-700 font-medium"
            >
              Progress
            </button>
            .
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-xs font-semibold text-slate-muted hover:text-navy-900 transition-colors"
          aria-label="Back to Home"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>
        <Badge variant="teal" icon={<ClipboardCheck className="w-3.5 h-3.5" />}>
          Daily Check-in
        </Badge>
      </div>

      <div>
        <h1 className="text-xl font-bold text-navy-900">Today's Symptom Log</h1>
        <p className="text-xs text-slate-muted mt-0.5">
          Your daily responses help your care team monitor joint health and catch recovery
          concerns early.
        </p>
      </div>

      {/* Main form / success state */}
      {todaysCheckin && submittedCheckin ? renderSuccessState() : renderForm()}

      {/* History section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-slate-muted" />
          <h2 className="text-xs font-semibold text-slate-muted uppercase tracking-wider">
            Previous Check-ins
          </h2>
        </div>
        {renderHistory()}
      </div>

      {/* ── Emergency Modal ────────────────────────────────────────────── */}
      <Modal
        isOpen={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        title="Immediate Action Required"
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-3">
              <AlertOctagon className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-red-700">
              Please Seek Emergency Medical Care Now
            </h3>
            <p className="text-xs text-slate-muted mt-2 leading-relaxed max-w-sm">
              You selected <strong>chest pain or difficulty breathing</strong>. In the
              post-surgical recovery period, these symptoms must be evaluated in person
              immediately to rule out serious complications.
            </p>
          </div>

          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-2">
            <p className="font-semibold">Steps to take right now:</p>
            <ul className="space-y-1.5 list-none">
              <li className="flex items-start gap-2">
                <span className="font-bold text-red-600 flex-shrink-0">1.</span>
                Call 911 or your local emergency services immediately.
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-red-600 flex-shrink-0">2.</span>
                Do not drive yourself — wait for emergency personnel.
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-red-600 flex-shrink-0">3.</span>
                Tell emergency staff you had recent knee replacement surgery.
              </li>
            </ul>
          </div>

          <p className="text-[10px] text-center text-slate-muted">
            This app cannot assess or diagnose your condition. Emergency personnel are the
            appropriate escalation path.
          </p>

          <div className="flex gap-2">
            <Button
              fullWidth
              variant="danger"
              icon={<Phone className="w-4 h-4" />}
              onClick={() => {
                // On mobile, this triggers a call prompt
                window.location.href = 'tel:911';
              }}
            >
              Call Emergency Services
            </Button>
          </div>
          <Button
            fullWidth
            variant="outline"
            onClick={() => setShowEmergencyModal(false)}
          >
            I've Contacted Emergency Services
          </Button>
        </div>
      </Modal>
    </div>
  );
};
