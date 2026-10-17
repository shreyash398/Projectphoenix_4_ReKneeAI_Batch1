import { describe, it, expect } from 'vitest';
import {
  evaluateCheckinAlert,
  evaluateSessionAlert,
  evaluateEngagementGap,
  isDuplicateAlert,
} from '../lib/alerts/rules';
import { SymptomCheckin, ExerciseSession, Alert } from '../types/database';

describe('Alert Rule Engine', () => {
  it('triggers critical alert when chest pain or shortness of breath is reported', () => {
    const checkin: SymptomCheckin = {
      id: 'test-chk-1',
      patient_id: 'p1',
      pain_score: 3,
      symptoms: { chest_pain_shortness_breath: true },
      notes: '',
      created_at: new Date().toISOString(),
    };

    const result = evaluateCheckinAlert(checkin);
    expect(result.shouldAlert).toBe(true);
    expect(result.category).toBe('clinical_review');
    expect(result.severity).toBe('critical');
    expect(result.reason).toContain('CRITICAL RED-FLAG');
  });

  it('triggers urgent alert when calf pain is reported with elevated pain score', () => {
    const checkin: SymptomCheckin = {
      id: 'test-chk-2',
      patient_id: 'p1',
      pain_score: 6,
      symptoms: { calf_pain: true, swelling: true },
      notes: 'Calf feels tight and sore',
      created_at: new Date().toISOString(),
    };

    const result = evaluateCheckinAlert(checkin);
    expect(result.shouldAlert).toBe(true);
    expect(result.category).toBe('clinical_review');
    expect(result.severity).toBe('urgent');
    expect(result.reason).toContain('DVT precaution');
  });

  it('triggers urgent alert when acute pain is 8 or higher', () => {
    const checkin: SymptomCheckin = {
      id: 'test-chk-3',
      patient_id: 'p1',
      pain_score: 8,
      symptoms: { swelling: true },
      notes: 'Hurts badly',
      created_at: new Date().toISOString(),
    };

    const result = evaluateCheckinAlert(checkin);
    expect(result.shouldAlert).toBe(true);
    expect(result.category).toBe('clinical_review');
    expect(result.severity).toBe('urgent');
  });

  it('does not trigger clinical alert for expected mild post-op symptoms', () => {
    const checkin: SymptomCheckin = {
      id: 'test-chk-4',
      patient_id: 'p1',
      pain_score: 3,
      symptoms: { stiffness: true, swelling: true },
      notes: 'Morning stiffness after sleeping',
      created_at: new Date().toISOString(),
    };

    const result = evaluateCheckinAlert(checkin);
    expect(result.shouldAlert).toBe(false);
  });

  it('triggers moderate alert when session stops early with low reps', () => {
    const session: ExerciseSession = {
      id: 'sess-1',
      patient_id: 'p1',
      plan_exercise_id: 'ex-1',
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: 20,
      repetitions: 2,
      status: 'stopped_early',
      measurement_mode: 'camera_prototype',
      created_at: new Date().toISOString(),
    };

    const result = evaluateSessionAlert(session);
    expect(result.shouldAlert).toBe(true);
    expect(result.category).toBe('clinical_review');
    expect(result.severity).toBe('moderate');
  });

  it('detects duplicate alerts within 24 hours to prevent clinician alert fatigue', () => {
    const existingAlerts: Alert[] = [
      {
        id: 'alt-1',
        patient_id: 'p1',
        category: 'clinical_review',
        severity: 'urgent',
        source_type: 'symptom_checkin',
        source_id: 'test-chk-2',
        reason: 'Patient reported calf pain/tightness with pain score 6/10',
        status: 'new',
        created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        reviewed_at: null,
        reviewed_by: null,
      },
    ];

    const duplicateAttempt: Partial<Alert> = {
      patient_id: 'p1',
      source_id: 'test-chk-2',
      reason: 'Patient reported calf pain/tightness with pain score 6/10',
    };

    expect(isDuplicateAlert(existingAlerts, duplicateAttempt)).toBe(true);

    const nonDuplicateAttempt: Partial<Alert> = {
      patient_id: 'p1',
      source_id: 'different-chk',
      reason: 'Different reason entirely',
    };

    expect(isDuplicateAlert(existingAlerts, nonDuplicateAttempt)).toBe(false);
  });

  it('triggers engagement reminder when no recovery activity for over 48 hours', () => {
    const twoDaysAgo = new Date(Date.now() - 50 * 3600000);
    const result = evaluateEngagementGap(twoDaysAgo);
    expect(result.shouldAlert).toBe(true);
    expect(result.category).toBe('engagement');
    expect(result.severity).toBe('moderate');
  });
});
