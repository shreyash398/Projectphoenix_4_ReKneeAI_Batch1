// ReKnee AI — Daily Recovery Check-in
// Patients record pain score, structured symptoms, and optional notes.
// Configurable deterministic alert rules create review signals without diagnosis.

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Send,
  AlertOctagon,
  AlertTriangle,
  Phone,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
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
    description: 'Common early post-op, eases with gentle movement',
    tier: 'routine',
  },
  {
    key: 'swelling',
    label: 'Puffiness or swelling around the knee',
    description: 'Manage with elevation and ice packs as instructed',
    tier: 'routine',
  },
  {
    key: 'warmth',
    label: 'Localized warmth to the touch',
    description: 'Mild warmth is common post-operatively',
    tier: 'routine',
  },
  {
    key: 'numbness',
    label: 'Numbness or tingling around the incision',
    description: 'Nerve recovery can take months',
    tier: 'routine',
  },
  {
    key: 'redness',
    label: 'Spreading redness beyond the incision',
    description: 'Your care team may want to review',
    tier: 'watch',
  },
  {
    key: 'fever',
    label: 'Oral fever ≥ 100.4 °F (38 °C)',
    description: 'Note onset time in your notes',
    tier: 'watch',
  },
  {
    key: 'calfPain',
    label: 'New calf pain or cramping tightness',
    description: 'Report to your care team promptly',
    tier: 'urgent',
  },
  {
    key: 'chestPain',
    label: 'Chest pain or difficulty breathing',
    description: 'Requires immediate emergency evaluation',
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

function isSameDay(isoA: string, isoB: string): boolean {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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
    <Card className="p-6 border-slate-200/80 shadow-soft">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-base font-bold text-navy-900">
          Pain level
        </h2>
        <span
          className={`text-sm font-bold px-3 py-1 rounded-full border tabular-nums ${tier.bg} ${tier.color} ${tier.border} shadow-soft`}
          aria-live="polite"
        >
          {value} of 10
        </span>
      </div>

      {/* Visual pain slider */}
      <div className="relative mb-5 pt-2">
        <input
          id="pain-slider"
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="w-full h-3 rounded-lg appearance-none cursor-pointer accent-teal-calm bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-calm"
          aria-valuemin={0}
          aria-valuemax={10}
          aria-valuenow={value}
          aria-label="Pain scale 0 to 10"
        />
        <div className="flex justify-between text-[11px] text-slate-400 mt-2 font-medium select-none px-1">
          <span>0 (None)</span>
          <span>3 (Mild)</span>
          <span>5 (Moderate)</span>
          <span>8 (Severe)</span>
          <span>10 (Worst)</span>
        </div>

        {/* Discrete Tap Numbers */}
        <div className="grid grid-cols-11 gap-1.5 pt-4">
          {Array.from({ length: 11 }, (_, i) => {
            const isSelected = value === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onChange(i)}
                className={`min-h-[38px] text-xs font-bold rounded-xl border transition-all duration-150 ${
                  isSelected
                    ? i >= 8
                      ? 'bg-status-error text-white border-status-error shadow-card'
                      : 'bg-teal-calm text-white border-teal-calm shadow-card scale-105'
                    : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-white hover:border-slate-300'
                }`}
                aria-label={`Select pain score ${i}`}
              >
                {i}
              </button>
            );
          })}
        </div>
      </div>

      {/* Descriptor pill */}
      <div className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${tier.bg} ${tier.color} ${tier.border}`}>
        <span className="w-2 h-2 rounded-full bg-current" />
        <span>{PAIN_DESCRIPTORS[value]}</span>
      </div>

      {/* High-pain calm advisory */}
      {value >= 8 && (
        <div className="mt-3.5 flex items-start gap-3 p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 shadow-soft">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">
              Your care team has been notified for review.
            </p>
          </div>
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
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 ${
        checked
          ? field.tier === 'urgent'
            ? 'border-rose-300 bg-rose-50/60 shadow-soft'
            : 'border-teal-calm bg-teal-light shadow-soft'
          : 'border-slate-200/80 bg-white hover:bg-slate-50'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 mt-0.5 shrink-0 rounded text-teal-calm focus:ring-teal-calm border-slate-300 transition-colors"
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

// ─── Main Component ───────────────────────────────────────────────────────────

export const DailyCheckin: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

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
    try {
      const list = await repository.getSymptomCheckins(activeProfile.id);
      setPreviousCheckins(list);
    } catch {
      // Fail silently on non-critical background fetch
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
    } catch {
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
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-navy-900">Check-in recorded</h2>
            <p className="text-xs text-slate-500 mt-1">
              Pain level:{' '}
              <span className={`font-semibold ${tier.color}`}>
                {todaysCheckin.pain_score} of 10
              </span>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-2 pt-2 px-4">
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
              Update check-in
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/')}>
              Return to Home
            </Button>
          </div>
        </Card>

        {/* Clinical alert notification */}
        {alertTriggered && (
          <div
            className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl"
            role="alert"
          >
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 space-y-1">
              <p className="font-semibold">Your care team has been notified for review.</p>
            </div>
          </div>
        )}
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

      {/* Symptoms */}
      <Card className="p-6 border-slate-200/80 shadow-soft">
        <h2 className="text-base font-bold text-navy-900 mb-3">
          Symptoms
        </h2>
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
      <Card className="p-6 border-slate-200/80 shadow-soft">
        <label
          htmlFor="notes-field"
          className="text-base font-bold text-navy-900 block mb-2"
        >
          Notes (Optional)
        </label>
        <textarea
          id="notes-field"
          rows={3}
          maxLength={NOTES_MAX}
          placeholder="Any notes for your care team..."
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          className={`w-full text-xs p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-calm bg-warm-bg/40 resize-none text-navy-900 leading-relaxed ${
            errors.notes ? 'border-status-error' : 'border-warm-border focus:border-teal-calm'
          }`}
        />
        <div className="flex justify-end text-[11px] text-slate-400 mt-1">
          <span>{form.notes.length}/{NOTES_MAX}</span>
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
        Submit check-in
      </Button>
    </form>
  );

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-8">
      {/* Page Header */}
      <div className="border-b border-slate-200/60 pb-4">
        <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
          How are you feeling today?
        </h1>
      </div>

      {/* Main form or confirmation state */}
      {todaysCheckin && submittedCheckin ? renderSuccessState() : renderForm()}

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
