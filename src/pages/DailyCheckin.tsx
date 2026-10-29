// ReKnee AI — Daily Recovery Check-in
// Styled to match Stitch "Clinical Kineticism" design system with interactive slider, multi-select chips, and clinical safety protocol

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Send,
  Check,
  Heart,
  Clock,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';

interface SymptomOption {
  id: string;
  label: string;
  tier: 'routine' | 'watch' | 'urgent';
}

const SYMPTOM_OPTIONS: SymptomOption[] = [
  { id: 'swelling', label: 'Swelling', tier: 'routine' },
  { id: 'stiffness', label: 'Morning Stiffness', tier: 'routine' },
  { id: 'warmth', label: 'Warmth', tier: 'routine' },
  { id: 'redness', label: 'Redness', tier: 'watch' },
  { id: 'wound', label: 'Wound Concern', tier: 'watch' },
  { id: 'calfPain', label: 'Calf Pain', tier: 'urgent' },
  { id: 'chestPain', label: 'Chest Tightness', tier: 'urgent' },
  { id: 'none', label: 'None', tier: 'routine' },
];

const PAIN_DESCRIPTIONS: Record<number, { label: string; note: string; color: string; badgeClass: string }> = {
  0: { label: 'No pain', note: 'Feeling comfortable and light', color: '#16a878', badgeClass: 'bg-primary-fixed text-on-primary-fixed' },
  1: { label: 'Minimal', note: 'Barely perceptible baseline', color: '#16a878', badgeClass: 'bg-primary-fixed text-on-primary-fixed' },
  2: { label: 'Very mild', note: 'Subtle twinge, easily ignored', color: '#16a878', badgeClass: 'bg-primary-fixed text-on-primary-fixed' },
  3: { label: 'Mild', note: 'Noticeable, doesn’t limit rest', color: '#16a878', badgeClass: 'bg-primary-fixed text-on-primary-fixed' },
  4: { label: 'Mild to moderate', note: 'Manageable during rest', color: '#16a878', badgeClass: 'bg-primary-fixed text-on-primary-fixed' },
  5: { label: 'Moderate', note: 'Noticeable during light steps', color: '#d97706', badgeClass: 'bg-amber-100 text-amber-900' },
  6: { label: 'Moderately high', note: 'Requires rest breaks', color: '#d97706', badgeClass: 'bg-amber-100 text-amber-900' },
  7: { label: 'Elevated', note: 'Noticeable even while resting', color: '#ea580c', badgeClass: 'bg-error-container text-on-error-container' },
  8: { label: 'Intense', note: 'Difficult to bend or straighten', color: '#ba1a1a', badgeClass: 'bg-error-container text-on-error-container' },
  9: { label: 'Severe', note: 'Movement strongly limited', color: '#ba1a1a', badgeClass: 'bg-error-container text-on-error-container' },
  10: { label: 'Extreme', note: 'Unbearable pain threshold', color: '#ba1a1a', badgeClass: 'bg-error-container text-on-error-container' },
};

export const DailyCheckin: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

  const [painScore, setPainScore] = useState<number>(4);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['swelling']);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [urgentEmergencyActive, setUrgentEmergencyActive] = useState<boolean>(false);

  // Symptom toggle logic
  const handleToggleSymptom = (id: string) => {
    if (id === 'none') {
      setSelectedSymptoms(['none']);
      return;
    }

    let updated = selectedSymptoms.filter((s) => s !== 'none');
    if (updated.includes(id)) {
      updated = updated.filter((s) => s !== id);
    } else {
      updated.push(id);
    }

    if (updated.length === 0) {
      updated = ['none'];
    }
    setSelectedSymptoms(updated);
  };

  // Urgent symptoms check (chestPain or calfPain)
  useEffect(() => {
    const hasUrgent = selectedSymptoms.includes('chestPain') || selectedSymptoms.includes('calfPain');
    setUrgentEmergencyActive(hasUrgent);
  }, [selectedSymptoms]);

  const currentInfo = PAIN_DESCRIPTIONS[painScore] || PAIN_DESCRIPTIONS[4];

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const symptomsMap: Record<string, boolean> = {};
      selectedSymptoms.forEach((s) => {
        if (s !== 'none') symptomsMap[s] = true;
      });

      await repository.saveSymptomCheckin({
        patient_id: activeProfile.id,
        pain_score: painScore,
        symptoms: symptomsMap,
        notes: notes.trim(),
      });

      setSubmitSuccess(true);
      setToastMessage('Daily check-in logged and sent to your clinical team.');

      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      console.error('Failed to submit check-in:', err);
      setToastMessage('Failed to save check-in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto space-y-5 pb-8">
      {/* ─── Header & Context ──────────────────────────────────── */}
      <div className="pt-1 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-primary">
          <Sparkles className="w-4 h-4" />
          <span className="text-[11px] font-bold uppercase tracking-wider">
            Day 14 Post-Op Rehab
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
          How are you feeling today?
        </h1>
        <p className="text-sm text-on-surface-variant">
          Take a quiet moment to record how your knee feels right now.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ─── 1. Pain Level Slider Card ──────────────────────── */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] border border-surface-container-high/60 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Pain Level
            </span>
            <span className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors duration-300 ${currentInfo.badgeClass}`}>
              {currentInfo.label}
            </span>
          </div>

          {/* Prominent Value Display */}
          <div className="flex items-baseline justify-between pt-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl sm:text-5xl font-bold text-on-surface leading-none tracking-tight">
                {painScore}
              </span>
              <span className="text-lg font-semibold text-on-surface-variant">/ 10</span>
            </div>
            <span className="text-xs text-on-surface-variant text-right max-w-[160px] leading-tight">
              {currentInfo.note}
            </span>
          </div>

          {/* Custom Interactive Slider Track */}
          <div className="pt-2 pb-1 flex flex-col gap-2">
            <div className="relative w-full flex items-center h-8">
              {/* Gradient Track Bar */}
              <div className="w-full h-3 rounded-full bg-gradient-to-r from-primary-container via-[#f59e0b] to-error opacity-80 pointer-events-none relative overflow-hidden">
                <div
                  className="absolute inset-y-0 right-0 bg-surface-container-high/60 transition-all duration-75"
                  style={{ left: `${painScore * 10}%` }}
                />
              </div>

              {/* Native Range Slider */}
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={painScore}
                onChange={(e) => setPainScore(parseInt(e.target.value, 10))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                aria-label="Pain level from 0 to 10"
              />

              {/* Custom Thumb Indicator */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.22)] pointer-events-none flex items-center justify-center transition-all"
                style={{ left: `${painScore * 10}%` }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full transition-colors"
                  style={{ backgroundColor: currentInfo.color }}
                />
              </div>
            </div>

            {/* Scale Milestones */}
            <div className="flex justify-between items-center text-on-surface-variant px-1 text-xs font-medium">
              <div className="flex flex-col items-start">
                <span className="font-bold text-on-surface">0</span>
                <span className="text-[10px] text-outline">None</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-bold text-on-surface">5</span>
                <span className="text-[10px] text-outline">Moderate</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-bold text-on-surface">10</span>
                <span className="text-[10px] text-outline">Severe</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 2. Symptom Selection Chips ─────────────────────── */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] border border-surface-container-high/60 flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-on-surface">Any symptoms today?</h3>
            <span className="text-xs text-on-surface-variant">Select all that apply</span>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            {SYMPTOM_OPTIONS.map((sym) => {
              const isSelected = selectedSymptoms.includes(sym.id);
              return (
                <button
                  key={sym.id}
                  type="button"
                  onClick={() => handleToggleSymptom(sym.id)}
                  className={`px-4 py-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-95 ${
                    isSelected
                      ? 'bg-primary-container text-on-primary-container shadow-sm'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                  <span>{sym.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Helpful Tip */}
          <div className="pt-2 flex items-center gap-2 text-on-surface-variant text-xs">
            <div className="w-4 h-4 rounded-full bg-primary-fixed/40 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-2.5 h-2.5" />
            </div>
            <span>Mild swelling and stiffness are typical during the first 6 weeks of active rehab.</span>
          </div>
        </div>

        {/* ─── 3. Notes Textarea Card ─────────────────────────── */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] border border-surface-container-high/60 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="notes" className="text-base font-bold text-on-surface">
              Anything else to share?
            </label>
            <span className="text-xs text-on-surface-variant">Optional</span>
          </div>
          <p className="text-xs text-on-surface-variant">
            Log small wins, sleep comfort, or stiffness patterns.
          </p>

          <div className="mt-2 relative rounded-2xl bg-surface-container-low focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-container transition-all">
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Mild stiffness after morning walk, eased up after ice pack..."
              className="w-full bg-transparent p-3.5 text-sm text-on-surface placeholder:text-outline focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* ─── 4. Safety Protocol Banner ──────────────────────── */}
        {painScore >= 7 || urgentEmergencyActive ? (
          <div className="rounded-2xl p-4 bg-error-container text-on-error-container flex items-start gap-3.5 border border-error/20">
            <div className="w-9 h-9 rounded-full bg-white text-error flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold uppercase tracking-wider text-error">
                Clinical Priority Notification
              </span>
              <p className="text-xs leading-relaxed text-on-error-container">
                Your reported pain ({painScore}/10) or urgent symptoms will trigger an immediate alert in your clinician's portal for rapid review.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-4 bg-purple-50 text-purple-950 flex items-start gap-3.5 border border-purple-200/60">
            <div className="w-9 h-9 rounded-full bg-white text-secondary flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Heart className="w-5 h-5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-on-surface">Care Team Protocol</span>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Your care team monitors your daily logs. If pain exceeds 7/10 or sudden swelling occurs, alerts are generated automatically.
              </p>
            </div>
          </div>
        )}

        {/* ─── 5. Submit Action Button ────────────────────────── */}
        <div className="pt-2 flex flex-col gap-2.5">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-[52px] rounded-full bg-primary-container text-on-primary-container font-bold text-base flex items-center justify-center gap-2 shadow-[0_8px_20px_-4px_rgba(22,168,120,0.35)] hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="animate-spin text-lg">⏳</span>
            ) : submitSuccess ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Check-in Logged!</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Submit check-in</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-on-surface-variant text-xs">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>Recorded to Dr. Patel's Portal upon submission</span>
          </div>
        </div>
      </form>

      {/* ─── Micro Toast Notification ─────────────────────────── */}
      {toastMessage && (
        <div className="fixed top-20 inset-x-4 max-w-md mx-auto z-50 flex items-center gap-3 p-4 rounded-2xl bg-on-surface text-surface shadow-float animate-fade-in">
          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">Daily Entry Saved</span>
            <span className="text-xs text-surface-container-high">{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};
