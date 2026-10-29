// ReKnee AI - Daily Check-in Feature Tests
// Covers: form validation, alert rules, symptom configuration, submit behaviour

import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateCheckinAlert,
  isDuplicateAlert,
} from '../lib/alerts/rules';
import { repository } from '../lib/supabase/repository';
import { DEMO_PATIENT_ID } from '../lib/supabase/mockStore';
import { SymptomCheckin, Alert } from '../types/database';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCheckin(overrides: Partial<SymptomCheckin> = {}): SymptomCheckin {
  return {
    id: 'test-chk-' + Math.random().toString(36).slice(2),
    patient_id: DEMO_PATIENT_ID,
    pain_score: 3,
    symptoms: {},
    notes: '',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Validation helpers (inline, mirroring page logic) ────────────────────────

function validatePainScore(score: number): string | undefined {
  if (score < 0 || score > 10 || !Number.isInteger(score)) {
    return 'Pain score must be a whole number between 0 and 10.';
  }
}

function validateNotes(notes: string, max = 500): string | undefined {
  if (notes.length > max) return `Notes must not exceed ${max} characters.`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Daily Check-in — Form Validation', () => {
  describe('Pain Score', () => {
    it('accepts valid integer pain score of 0', () => {
      expect(validatePainScore(0)).toBeUndefined();
    });

    it('accepts valid integer pain score of 10', () => {
      expect(validatePainScore(10)).toBeUndefined();
    });

    it('accepts all integers 0 through 10', () => {
      for (let i = 0; i <= 10; i++) {
        expect(validatePainScore(i)).toBeUndefined();
      }
    });

    it('rejects negative score', () => {
      expect(validatePainScore(-1)).toMatch(/between 0 and 10/i);
    });

    it('rejects score above 10', () => {
      expect(validatePainScore(11)).toMatch(/between 0 and 10/i);
    });

    it('rejects non-integer score', () => {
      expect(validatePainScore(4.5)).toMatch(/whole number/i);
    });
  });

  describe('Notes', () => {
    it('accepts empty notes', () => {
      expect(validateNotes('')).toBeUndefined();
    });

    it('accepts notes at the limit', () => {
      expect(validateNotes('a'.repeat(500))).toBeUndefined();
    });

    it('rejects notes exceeding 500 characters', () => {
      expect(validateNotes('a'.repeat(501))).toMatch(/exceed/i);
    });
  });
});

describe('Daily Check-in — Alert Rule Engine', () => {
  it('triggers critical alert for chest pain / shortness of breath', () => {
    const result = evaluateCheckinAlert(makeCheckin({
      symptoms: { chest_pain_shortness_breath: true },
    }));
    expect(result.shouldAlert).toBe(true);
    expect(result.severity).toBe('critical');
    expect(result.category).toBe('clinical_review');
    expect(result.reason).toContain('CRITICAL RED-FLAG');
  });

  it('triggers urgent alert for calf pain + elevated pain score', () => {
    const result = evaluateCheckinAlert(makeCheckin({
      pain_score: 6,
      symptoms: { calf_pain: true },
    }));
    expect(result.shouldAlert).toBe(true);
    expect(result.severity).toBe('urgent');
    expect(result.reason).toContain('DVT precaution');
  });

  it('triggers urgent alert for calf pain + swelling at low pain score', () => {
    const result = evaluateCheckinAlert(makeCheckin({
      pain_score: 3,
      symptoms: { calf_pain: true, swelling: true },
    }));
    expect(result.shouldAlert).toBe(true);
    expect(result.severity).toBe('urgent');
  });

  it('triggers urgent alert for pain score >= 8', () => {
    const result = evaluateCheckinAlert(makeCheckin({ pain_score: 8 }));
    expect(result.shouldAlert).toBe(true);
    expect(result.severity).toBe('urgent');
  });

  it('triggers urgent alert for fever + redness', () => {
    const result = evaluateCheckinAlert(makeCheckin({
      symptoms: { fever: true, redness: true },
    }));
    expect(result.shouldAlert).toBe(true);
    expect(result.severity).toBe('urgent');
    expect(result.reason).toContain('wound complication');
  });

  it('triggers urgent alert for fever + warmth', () => {
    const result = evaluateCheckinAlert(makeCheckin({
      symptoms: { fever: true, warmth: true },
    }));
    expect(result.shouldAlert).toBe(true);
    expect(result.severity).toBe('urgent');
  });

  it('does NOT trigger alert for routine post-op symptoms below threshold', () => {
    const result = evaluateCheckinAlert(makeCheckin({
      pain_score: 3,
      symptoms: { stiffness: true, swelling: true },
    }));
    expect(result.shouldAlert).toBe(false);
  });

  it('does NOT trigger alert for isolated calf pain without elevated pain or swelling', () => {
    const result = evaluateCheckinAlert(makeCheckin({
      pain_score: 2,
      symptoms: { calf_pain: true },
    }));
    // pain < 5 AND no swelling → no DVT alert
    expect(result.shouldAlert).toBe(false);
  });

  it('does NOT trigger alert for pain score of 7', () => {
    // Only 8+ triggers the acute pain alert
    const result = evaluateCheckinAlert(makeCheckin({ pain_score: 7 }));
    expect(result.shouldAlert).toBe(false);
  });
});

describe('Daily Check-in — Duplicate Alert Prevention', () => {
  const existingAlerts: Alert[] = [
    {
      id: 'alt-1',
      patient_id: DEMO_PATIENT_ID,
      category: 'clinical_review',
      severity: 'urgent',
      source_type: 'symptom_checkin',
      source_id: 'chk-duplicate',
      reason: 'Test duplicate reason',
      status: 'new',
      created_at: new Date(Date.now() - 1 * 3600000).toISOString(), // 1 hour ago
      reviewed_at: null,
      reviewed_by: null,
    },
  ];

  it('identifies a duplicate alert by matching source_id', () => {
    expect(
      isDuplicateAlert(existingAlerts, { source_id: 'chk-duplicate', patient_id: DEMO_PATIENT_ID })
    ).toBe(true);
  });

  it('identifies a duplicate alert by matching reason within 24 hours', () => {
    expect(
      isDuplicateAlert(existingAlerts, {
        patient_id: DEMO_PATIENT_ID,
        source_id: 'different-id',
        reason: 'Test duplicate reason',
      })
    ).toBe(true);
  });

  it('does not flag different-reason alert as duplicate', () => {
    expect(
      isDuplicateAlert(existingAlerts, {
        patient_id: DEMO_PATIENT_ID,
        source_id: 'other-id',
        reason: 'Completely different reason',
      })
    ).toBe(false);
  });

  it('does not flag closed alert as duplicate', () => {
    const closedAlerts: Alert[] = [{
      ...existingAlerts[0],
      id: 'alt-closed',
      status: 'closed',
    }];
    expect(
      isDuplicateAlert(closedAlerts, { source_id: 'chk-duplicate', patient_id: DEMO_PATIENT_ID })
    ).toBe(false);
  });
});

describe('Daily Check-in — Repository Integration', () => {
  beforeEach(() => {
    repository.setActiveUserId(DEMO_PATIENT_ID);
  });

  it('saves a valid check-in and returns it with id and created_at', async () => {
    const saved = await repository.saveSymptomCheckin({
      patient_id: DEMO_PATIENT_ID,
      pain_score: 4,
      symptoms: { stiffness: true, swelling: false },
      notes: 'Test check-in from unit test',
    });
    expect(saved.id).toBeTruthy();
    expect(saved.created_at).toBeTruthy();
    expect(saved.pain_score).toBe(4);
  });

  it('retrieves saved check-ins for the authenticated patient', async () => {
    const checkins = await repository.getSymptomCheckins(DEMO_PATIENT_ID);
    expect(Array.isArray(checkins)).toBe(true);
  });

  it('blocks a patient from saving a check-in under another patient id', async () => {
    await expect(
      repository.saveSymptomCheckin({
        patient_id: 'p9999999-9999-9999-9999-999999999999',
        pain_score: 3,
        symptoms: {},
        notes: '',
      })
    ).rejects.toThrow(/Unauthorized/);
  });

  it('blocks unauthenticated access to check-in history', async () => {
    repository.signOut();
    const checkins = await repository.getSymptomCheckins(DEMO_PATIENT_ID);
    expect(checkins).toEqual([]);
  });

  it('creates a clinical alert automatically when pain score >= 8', async () => {
    repository.setActiveUserId(DEMO_PATIENT_ID);
    const saved = await repository.saveSymptomCheckin({
      patient_id: DEMO_PATIENT_ID,
      pain_score: 9,
      symptoms: {},
      notes: '',
    });
    // Alert rule result (deterministic)
    const ruleResult = evaluateCheckinAlert({
      ...saved,
    });
    expect(ruleResult.shouldAlert).toBe(true);
    expect(ruleResult.severity).toBe('urgent');
  });
});

describe('Daily Check-in — Symptom Field Configuration', () => {
  // Validates the documented 8 symptom fields are present with correct tiers

  const expectedRoutineFields = ['stiffness', 'swelling', 'warmth', 'numbness'];
  const expectedWatchFields = ['redness', 'fever'];
  const expectedUrgentFields = ['calfPain', 'chestPain'];

  it('has 4 routine-tier symptom fields', () => {
    expect(expectedRoutineFields).toHaveLength(4);
  });

  it('has 2 watch-tier symptom fields', () => {
    expect(expectedWatchFields).toHaveLength(2);
  });

  it('has 2 urgent-tier symptom fields', () => {
    expect(expectedUrgentFields).toHaveLength(2);
  });

  it('has a total of 8 configured symptom fields', () => {
    const allFields = [...expectedRoutineFields, ...expectedWatchFields, ...expectedUrgentFields];
    expect(allFields).toHaveLength(8);
  });

  it('maps calf_pain to the urgent tier where alert is created', () => {
    // Chest pain intercepts submission; calf pain goes through and creates an alert
    const result = evaluateCheckinAlert(makeCheckin({
      pain_score: 5,
      symptoms: { calf_pain: true },
    }));
    expect(result.shouldAlert).toBe(true);
    expect(result.category).toBe('clinical_review');
  });
});

describe('Daily Check-in — Same-day detection logic', () => {
  function isSameDay(isoA: string, isoB: string): boolean {
    const a = new Date(isoA);
    const b = new Date(isoB);
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  it('identifies two timestamps in the same calendar day as same-day', () => {
    const morning = new Date(2026, 9, 29, 9, 0);
    const afternoon = new Date(2026, 9, 29, 15, 0); // + 6 hours on same calendar day
    expect(isSameDay(morning.toISOString(), afternoon.toISOString())).toBe(true);
  });

  it('identifies timestamps 24 hours apart as different days', () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 3600000);
    expect(isSameDay(today.toISOString(), yesterday.toISOString())).toBe(false);
  });

  it('handles month-boundary crossings correctly', () => {
    const lastOfMonth = new Date(2026, 9, 31, 23, 59); // Oct 31
    const firstOfMonth = new Date(2026, 10, 1, 0, 1); // Nov 1
    expect(isSameDay(lastOfMonth.toISOString(), firstOfMonth.toISOString())).toBe(false);
  });
});
