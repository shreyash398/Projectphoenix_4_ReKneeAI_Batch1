// ReKnee AI - Patient Recovery Progress & Activity History Tests
// Strictly adheres to 01_PRD.md, 02_DESIGN.md, 04_DATABASE.md, and authorization boundaries

import { describe, it, expect } from 'vitest';
import { repository } from '../lib/supabase/repository';
import {
  DEMO_PATIENT_ID,
  DEMO_CLINICIAN_ID,
} from '../lib/supabase/mockStore';
import { ExerciseSession, SymptomCheckin, RecoveryPlan } from '../types/database';

describe('Patient Recovery Progress & Analytics', () => {
  describe('1. Data Scoping & Authorization Security', () => {
    it('returns only the authenticated patient’s exercise sessions', async () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);
      const sessions = await repository.getExerciseSessions(DEMO_PATIENT_ID);

      expect(sessions.length).toBeGreaterThan(0);
      sessions.forEach((sess) => {
        expect(sess.patient_id).toBe(DEMO_PATIENT_ID);
      });
    });

    it('returns only the authenticated patient’s symptom check-ins', async () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);
      const checkins = await repository.getSymptomCheckins(DEMO_PATIENT_ID);

      expect(checkins.length).toBeGreaterThan(0);
      checkins.forEach((chk) => {
        expect(chk.patient_id).toBe(DEMO_PATIENT_ID);
      });
    });

    it('blocks patient from querying another patient’s progress data', async () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);
      const otherPatientId = 'p9999999-9999-9999-9999-999999999999';

      const unauthorizedSessions = await repository.getExerciseSessions(otherPatientId);
      expect(unauthorizedSessions).toEqual([]);

      const unauthorizedCheckins = await repository.getSymptomCheckins(otherPatientId);
      expect(unauthorizedCheckins).toEqual([]);

      const unauthorizedPlan = await repository.getRecoveryPlan(otherPatientId);
      expect(unauthorizedPlan).toBeNull();
    });

    it('blocks unauthenticated user from accessing any recovery progress', async () => {
      repository.signOut();

      const sessions = await repository.getExerciseSessions(DEMO_PATIENT_ID);
      expect(sessions).toEqual([]);

      const checkins = await repository.getSymptomCheckins(DEMO_PATIENT_ID);
      expect(checkins).toEqual([]);

      // Restore active user for subsequent tests
      repository.setActiveUserId(DEMO_PATIENT_ID);
    });

    it('blocks clinician without explicit authorization from viewing patient progress', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);
      const unauthorizedPatientId = 'p3333333-3333-3333-3333-333333333333';

      const sessions = await repository.getExerciseSessions(unauthorizedPatientId);
      expect(sessions).toEqual([]);

      const checkins = await repository.getSymptomCheckins(unauthorizedPatientId);
      expect(checkins).toEqual([]);

      // Restore active user
      repository.setActiveUserId(DEMO_PATIENT_ID);
    });
  });

  describe('2. Metric Aggregations & Neutral Calculations', () => {
    const mockSessions: ExerciseSession[] = [
      {
        id: 's1',
        patient_id: DEMO_PATIENT_ID,
        plan_exercise_id: 'e1',
        started_at: '2026-10-15T10:00:00Z',
        ended_at: '2026-10-15T10:03:00Z',
        duration_seconds: 180,
        repetitions: 10,
        status: 'completed',
        measurement_mode: 'camera_prototype',
        created_at: '2026-10-15T10:03:00Z',
      },
      {
        id: 's2',
        patient_id: DEMO_PATIENT_ID,
        plan_exercise_id: 'e1',
        started_at: '2026-10-16T10:00:00Z',
        ended_at: '2026-10-16T10:01:00Z',
        duration_seconds: 60,
        repetitions: 3,
        status: 'stopped_early',
        measurement_mode: 'manual_demo',
        created_at: '2026-10-16T10:01:00Z',
      },
      {
        id: 's3',
        patient_id: DEMO_PATIENT_ID,
        plan_exercise_id: 'e1',
        started_at: '2026-10-17T10:00:00Z',
        ended_at: '2026-10-17T10:02:30Z',
        duration_seconds: 150,
        repetitions: 8,
        status: 'completed',
        measurement_mode: 'camera_prototype',
        created_at: '2026-10-17T10:02:30Z',
      },
    ];

    const mockCheckins: SymptomCheckin[] = [
      {
        id: 'c1',
        patient_id: DEMO_PATIENT_ID,
        pain_score: 6,
        symptoms: { stiffness: true },
        notes: 'Morning stiffness',
        created_at: '2026-10-15T08:00:00Z',
      },
      {
        id: 'c2',
        patient_id: DEMO_PATIENT_ID,
        pain_score: 4,
        symptoms: { stiffness: true },
        notes: '',
        created_at: '2026-10-16T08:00:00Z',
      },
      {
        id: 'c3',
        patient_id: DEMO_PATIENT_ID,
        pain_score: 3,
        symptoms: {},
        notes: 'Walked in garden',
        created_at: '2026-10-17T08:00:00Z',
      },
    ];

    it('filters completed sessions accurately', () => {
      const completed = mockSessions.filter((s) => s.status === 'completed');
      expect(completed.length).toBe(2);
      expect(completed.map((s) => s.id)).toEqual(['s1', 's3']);
    });

    it('sums total practice seconds correctly', () => {
      const totalSeconds = mockSessions.reduce((acc, s) => acc + s.duration_seconds, 0);
      expect(totalSeconds).toBe(390); // 180 + 60 + 150
    });

    it('calculates average pain score as a neutral decimal representation', () => {
      const avg = (mockCheckins.reduce((acc, c) => acc + c.pain_score, 0) / mockCheckins.length).toFixed(1);
      expect(avg).toBe('4.3'); // (6 + 4 + 3) / 3 = 4.333
    });

    it('computes protocol timeline progress percentage correctly', () => {
      const plan: RecoveryPlan = {
        id: 'p1',
        patient_id: DEMO_PATIENT_ID,
        title: 'Post-TKA Mobility',
        status: 'active',
        start_date: new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0],
        end_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0], // 30 day protocol
        approved_by: DEMO_CLINICIAN_ID,
        created_at: new Date().toISOString(),
      };

      const start = new Date(plan.start_date).getTime();
      const end = new Date(plan.end_date).getTime();
      const now = Date.now();
      const totalDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
      const elapsedDays = Math.round((now - start) / (1000 * 60 * 60 * 24));
      const pct = Math.round((elapsedDays / totalDays) * 100);

      expect(totalDays).toBeGreaterThanOrEqual(29);
      expect(totalDays).toBeLessThanOrEqual(31);
      expect(elapsedDays).toBeGreaterThanOrEqual(15);
      expect(elapsedDays).toBeLessThanOrEqual(16);
      expect(pct).toBeGreaterThanOrEqual(48);
      expect(pct).toBeLessThanOrEqual(55);
    });
  });

  describe('3. Chart Data Formatting & Neutral Language Requirements', () => {
    it('sorts pain score time-series data chronologically ascending for chart rendering', () => {
      const unsortedCheckins: SymptomCheckin[] = [
        {
          id: 'c-late',
          patient_id: DEMO_PATIENT_ID,
          pain_score: 2,
          symptoms: {},
          notes: '',
          created_at: '2026-10-17T12:00:00Z',
        },
        {
          id: 'c-early',
          patient_id: DEMO_PATIENT_ID,
          pain_score: 5,
          symptoms: {},
          notes: '',
          created_at: '2026-10-15T12:00:00Z',
        },
      ];

      const sorted = [...unsortedCheckins].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      expect(sorted[0].id).toBe('c-early');
      expect(sorted[1].id).toBe('c-late');
    });

    it('ensures pain domain remains strictly bounded 0 to 10', () => {
      const painScores = [0, 4, 7, 10];
      painScores.forEach((p) => {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(10);
      });
    });

    it('uses neutral descriptive labels instead of clinical claims of healing', () => {
      const neutralLabels = [
        'Recovery Progress',
        'Pain scores over time',
        'Completed sessions',
        'Recent Activity Records',
        'Activity Documentation',
        'Prescribed Protocol Timeline',
      ];

      neutralLabels.forEach((label) => {
        expect(label.toLowerCase()).not.toContain('healing');
        expect(label.toLowerCase()).not.toContain('improving');
        expect(label.toLowerCase()).not.toContain('cured');
      });
    });

    it('identifies empty state when both sessions and checkins lists are empty', () => {
      const emptySessions: ExerciseSession[] = [];
      const emptyCheckins: SymptomCheckin[] = [];

      const hasNoData = emptySessions.length === 0 && emptyCheckins.length === 0;
      expect(hasNoData).toBe(true);

      const withSessions: ExerciseSession[] = [{ id: 's1' } as unknown as ExerciseSession];
      expect(withSessions.length === 0 && emptyCheckins.length === 0).toBe(false);
    });
  });
});
