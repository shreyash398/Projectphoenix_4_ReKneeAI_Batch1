import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  CheckCircle2,
  Send,
  AlertOctagon,
  ArrowLeft,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import { SymptomCheckin } from '../types/database';

export const DailyCheckin: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getCurrentProfile();

  // Form states
  const [painScore, setPainScore] = useState<number>(3);
  const [swelling, setSwelling] = useState<boolean>(false);
  const [warmth, setWarmth] = useState<boolean>(false);
  const [redness, setRedness] = useState<boolean>(false);
  const [stiffness, setStiffness] = useState<boolean>(true);
  const [numbness, setNumbness] = useState<boolean>(false);
  const [calfPain, setCalfPain] = useState<boolean>(false);
  const [fever, setFever] = useState<boolean>(false);
  const [chestPain, setChestPain] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean>(false);
  const [emergencyAlertModal, setEmergencyAlertModal] = useState<boolean>(false);
  const [previousCheckins, setPreviousCheckins] = useState<SymptomCheckin[]>([]);

  useEffect(() => {
    const loadCheckins = async () => {
      const list = await repository.getSymptomCheckins(activeProfile.id);
      setPreviousCheckins(list);
    };
    loadCheckins();
  }, [activeProfile.id]);

  const getPainDescriptor = (val: number) => {
    if (val === 0) return { label: 'No Pain', color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (val <= 3) return { label: 'Mild Discomfort (Normal stretching)', color: 'text-teal-calm', bg: 'bg-teal-light' };
    if (val <= 6) return { label: 'Moderate Pain (Aching)', color: 'text-amber-600', bg: 'bg-amber-50' };
    if (val <= 8) return { label: 'Severe Pain (Alert trigger)', color: 'text-rose-600', bg: 'bg-rose-50' };
    return { label: 'Extreme Distress', color: 'text-red-700', bg: 'bg-red-100' };
  };

  const currentDescriptor = getPainDescriptor(painScore);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (chestPain) {
      setEmergencyAlertModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const checkinData: Omit<SymptomCheckin, 'id' | 'created_at'> = {
        patient_id: activeProfile.id,
        pain_score: painScore,
        symptoms: {
          swelling,
          warmth,
          redness,
          stiffness,
          numbness,
          calf_pain: calfPain,
          fever,
          chest_pain_shortness_breath: chestPain,
        },
        notes: notes.slice(0, 500).trim(),
      };

      await repository.saveSymptomCheckin(checkinData);
      setSubmissionSuccess(true);
      const updated = await repository.getSymptomCheckins(activeProfile.id);
      setPreviousCheckins(updated);
    } catch (err) {
      console.error('Failed to submit check-in:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-xs font-semibold text-slate-muted hover:text-navy-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <Badge variant="teal" icon={<ClipboardCheck className="w-3.5 h-3.5" />}>
          Daily Check-in
        </Badge>
      </div>

      <div>
        <h1 className="text-xl font-bold text-navy-900">Today’s Symptom Log</h1>
        <p className="text-xs text-slate-muted mt-0.5">
          Your daily responses help your care team monitor joint mobility and catch any recovery issues early.
        </p>
      </div>

      {submissionSuccess ? (
        <Card className="text-center py-8 space-y-4 bg-status-success-bg/30 border-emerald-200">
          <div className="w-14 h-14 bg-status-success text-white rounded-full mx-auto flex items-center justify-center shadow-soft">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-navy-900">Today’s Check-in Recorded!</h2>
            <p className="text-xs text-slate-muted max-w-xs mx-auto mt-1">
              Your pain score of {painScore}/10 and reported symptoms have been saved to your recovery record.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSubmissionSuccess(false)}>
              Update Check-in
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/')}>
              Return to Home
            </Button>
          </div>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pain Scale (0-10) */}
          <Card>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="pain-slider" className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                1. Knee Pain Level (0 to 10)
              </label>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${currentDescriptor.bg} ${currentDescriptor.color}`}>
                Score: {painScore}/10
              </span>
            </div>

            <p className="text-xs text-slate-muted mb-4">{currentDescriptor.label}</p>

            <input
              id="pain-slider"
              type="range"
              min="0"
              max="10"
              step="1"
              value={painScore}
              onChange={(e) => setPainScore(parseInt(e.target.value, 10))}
              className="w-full h-2.5 bg-warm-subtle rounded-lg appearance-none cursor-pointer accent-teal-calm"
            />

            <div className="flex justify-between text-[10px] text-slate-subtle mt-2 font-medium">
              <span>0 (None)</span>
              <span>3 (Mild)</span>
              <span>5 (Moderate)</span>
              <span>8 (Severe)</span>
              <span>10 (Worst)</span>
            </div>
          </Card>

          {/* Structured Symptoms Checklist */}
          <Card>
            <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2">
              2. Experienced Symptoms Today
            </h3>
            <p className="text-xs text-slate-muted mb-3">
              Select all sensations that you have observed around your knee or leg today.
            </p>

            <div className="space-y-2.5">
              <label className="flex items-center gap-3 p-2.5 rounded-lg border border-warm-border hover:bg-warm-subtle/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stiffness}
                  onChange={(e) => setStiffness(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-calm focus:ring-teal-calm border-warm-border"
                />
                <div className="text-xs">
                  <span className="font-semibold text-navy-900 block">Morning joint stiffness</span>
                  <span className="text-slate-subtle text-[11px]">Normal in early weeks, eases with gentle movement</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-2.5 rounded-lg border border-warm-border hover:bg-warm-subtle/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={swelling}
                  onChange={(e) => setSwelling(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-calm focus:ring-teal-calm border-warm-border"
                />
                <div className="text-xs">
                  <span className="font-semibold text-navy-900 block">Puffy swelling around joint</span>
                  <span className="text-slate-subtle text-[11px]">Can be managed with elevation and 15 min ice packs</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-2.5 rounded-lg border border-warm-border hover:bg-warm-subtle/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={warmth}
                  onChange={(e) => setWarmth(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-calm focus:ring-teal-calm border-warm-border"
                />
                <div className="text-xs">
                  <span className="font-semibold text-navy-900 block">Localized warmth to the touch</span>
                  <span className="text-slate-subtle text-[11px]">Mild warmth is common post-op</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-2.5 rounded-lg border border-warm-border hover:bg-warm-subtle/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={numbness}
                  onChange={(e) => setNumbness(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-calm focus:ring-teal-calm border-warm-border"
                />
                <div className="text-xs">
                  <span className="font-semibold text-navy-900 block">Numbness or tingling around incision</span>
                  <span className="text-slate-subtle text-[11px]">Nerve sensory recovery can take months</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-2.5 rounded-lg border border-amber-200 bg-amber-50/30 hover:bg-amber-50/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={calfPain}
                  onChange={(e) => setCalfPain(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-300"
                />
                <div className="text-xs">
                  <span className="font-semibold text-navy-900 flex items-center gap-1.5">
                    <span>New calf pain or cramping tightness</span>
                    <Badge variant="warning" size="sm">Clinician Review</Badge>
                  </span>
                  <span className="text-slate-muted text-[11px]">Important DVT precaution metric</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-2.5 rounded-lg border border-amber-200 bg-amber-50/30 hover:bg-amber-50/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={redness}
                  onChange={(e) => setRedness(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-300"
                />
                <div className="text-xs">
                  <span className="font-semibold text-navy-900 block">Spreading redness beyond incision perimeter</span>
                  <span className="text-slate-muted text-[11px]">Wound healing watch signal</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-2.5 rounded-lg border border-amber-200 bg-amber-50/30 hover:bg-amber-50/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fever}
                  onChange={(e) => setFever(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-300"
                />
                <div className="text-xs">
                  <span className="font-semibold text-navy-900 block">Oral fever ≥ 100.4°F (38°C)</span>
                  <span className="text-slate-muted text-[11px]">Infection watch signal</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-2.5 rounded-lg border border-red-200 bg-rose-50/30 hover:bg-rose-50/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chestPain}
                  onChange={(e) => setChestPain(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-rose-300"
                />
                <div className="text-xs">
                  <span className="font-semibold text-status-error flex items-center gap-1.5">
                    <span>Chest pain or difficulty breathing</span>
                    <Badge variant="error" size="sm">Emergency Signal</Badge>
                  </span>
                  <span className="text-slate-muted text-[11px]">Requires immediate emergency escalation</span>
                </div>
              </label>
            </div>
          </Card>

          {/* Notes for Care Team */}
          <Card>
            <label htmlFor="notes-field" className="text-xs font-bold text-navy-900 uppercase tracking-wider block mb-1">
              3. Notes for Your Physical Therapist (Optional)
            </label>
            <textarea
              id="notes-field"
              rows={3}
              maxLength={500}
              placeholder="e.g. Completed morning walk comfortably; knee felt tighter around 4 PM..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs p-3 rounded-lg border border-warm-border focus:border-teal-calm focus:ring-1 focus:ring-teal-calm bg-warm-bg/40 resize-none text-navy-900"
            />
            <div className="flex justify-between text-[11px] text-slate-subtle mt-1">
              <span>Do not include sensitive personal account information</span>
              <span>{notes.length}/500</span>
            </div>
          </Card>

          <Button
            type="submit"
            fullWidth
            size="lg"
            isLoading={isSubmitting}
            icon={<Send className="w-4 h-4" />}
          >
            Submit Daily Check-in
          </Button>
        </form>
      )}

      {/* Previous Check-in History */}
      <div className="pt-4">
        <h3 className="text-xs font-semibold text-slate-muted uppercase tracking-wider mb-2">
          Previous Check-in Records
        </h3>

        {previousCheckins.length === 0 ? (
          <Card>
            <p className="text-xs text-slate-muted text-center py-2">
              No check-in entries logged yet.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {previousCheckins.slice(0, 4).map((chk) => (
              <Card key={chk.id} className="py-2.5 px-3.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-navy-900">
                      Pain: {chk.pain_score}/10
                    </span>
                    {chk.pain_score >= 7 ? (
                      <Badge variant="warning" size="sm">Elevated</Badge>
                    ) : (
                      <Badge variant="success" size="sm">Controlled</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-subtle mt-0.5">
                    {new Date(chk.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {chk.notes ? ` • "${chk.notes.slice(0, 40)}..."` : ''}
                  </p>
                </div>
                <div className="text-right text-[11px] text-slate-muted">
                  {Object.keys(chk.symptoms).filter((k) => chk.symptoms[k]).length} symptoms noted
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Red-Flag Emergency Modal */}
      <Modal
        isOpen={emergencyAlertModal}
        onClose={() => setEmergencyAlertModal(false)}
        title="Immediate Emergency Action Required"
      >
        <div className="space-y-4 text-center">
          <div className="w-14 h-14 bg-status-error-bg text-status-error rounded-full mx-auto flex items-center justify-center">
            <AlertOctagon className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-base font-bold text-status-error">
              Please Seek Emergency Medical Care Immediately
            </h3>
            <p className="text-xs text-slate-muted mt-2 leading-relaxed">
              You selected chest pain or shortness of breath. In the post-surgical recovery period, these symptoms must be evaluated immediately in person to rule out pulmonary embolism or cardiac complications.
            </p>
          </div>

          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-left text-status-error font-medium">
            • Call 911 (or your local emergency services number) immediately.
            <br />
            • Do not drive yourself. Have emergency personnel or a companion assist you.
            <br />
            • Notify the emergency staff that you had knee replacement surgery recently.
          </div>

          <Button
            fullWidth
            variant="danger"
            onClick={() => setEmergencyAlertModal(false)}
          >
            I Understand — Calling Emergency Care
          </Button>
        </div>
      </Modal>
    </div>
  );
};
