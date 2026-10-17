import { describe, it, expect, beforeEach } from 'vitest';
import { repository } from '../lib/supabase/repository';
import { DEMO_PATIENT_ID, DEMO_CLINICIAN_ID } from '../lib/supabase/mockStore';

describe('Authentication & Authorization Security Tests', () => {
  const UNAUTHORIZED_PATIENT_ID = 'p9999999-9999-9999-9999-999999999999';
  const UNAUTHORIZED_CLINICIAN_ID = 'c9999999-9999-9999-9999-999999999999';

  beforeEach(() => {
    // Reset to authenticated patient by default
    repository.setActiveUserId(DEMO_PATIENT_ID);
  });

  describe('1. Unauthenticated Route & Session State', () => {
    it('returns null profile and unauthenticated state after sign out', () => {
      repository.signOut();
      const currentProfile = repository.getCurrentProfile();
      expect(currentProfile).toBeNull();
    });

    it('denies data access when unauthenticated', async () => {
      repository.signOut();
      const plan = await repository.getRecoveryPlan(DEMO_PATIENT_ID);
      expect(plan).toBeNull();
      expect(repository.getCurrentProfile()).toBeNull();
    });
  });

  describe('2. Patient Route & Role Access', () => {
    it('identifies authenticated patient with role patient', () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);
      const profile = repository.getCurrentProfile();
      expect(profile).not.toBeNull();
      expect(profile?.role).toBe('patient');
      expect(profile?.id).toBe(DEMO_PATIENT_ID);
    });

    it('allows patient to access only their own recovery plan', async () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);
      const ownPlan = await repository.getRecoveryPlan(DEMO_PATIENT_ID);
      expect(ownPlan).not.toBeNull();
      expect(ownPlan?.patient_id).toBe(DEMO_PATIENT_ID);
    });

    it('allows patient to view only their own alerts', async () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);
      const alerts = await repository.getAlerts();
      expect(alerts.every((a) => a.patient_id === DEMO_PATIENT_ID)).toBe(true);
    });
  });

  describe('3. Clinician Route & Role Access', () => {
    it('identifies authenticated clinician with role clinician', () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);
      const profile = repository.getCurrentProfile();
      expect(profile).not.toBeNull();
      expect(profile?.role).toBe('clinician');
      expect(profile?.id).toBe(DEMO_CLINICIAN_ID);
    });

    it('allows clinician to access authorized patient recovery plan', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);
      const plan = await repository.getRecoveryPlan(DEMO_PATIENT_ID);
      expect(plan).not.toBeNull();
      expect(plan?.patient_id).toBe(DEMO_PATIENT_ID);
    });

    it('retrieves only authorized patients for the clinician', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);
      const patients = await repository.getClinicianAuthorizedPatients(DEMO_CLINICIAN_ID);
      expect(patients.length).toBeGreaterThan(0);
      expect(patients.some((p) => p.id === DEMO_PATIENT_ID)).toBe(true);
      expect(patients.some((p) => p.id === UNAUTHORIZED_PATIENT_ID)).toBe(false);
    });
  });

  describe('4. Logout & Session Invalidation', () => {
    it('clears active credentials on logout', () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);
      expect(repository.getCurrentProfile()).not.toBeNull();

      repository.signOut();
      expect(repository.getCurrentProfile()).toBeNull();
    });
  });

  describe('5. Expired Session Handling', () => {
    it('invalidates current user profile on session expiration', () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);
      expect(repository.getCurrentProfile()?.role).toBe('clinician');

      // Simulate token expiration / invalidation
      repository.signOut();
      expect(repository.getCurrentProfile()).toBeNull();
    });
  });

  describe('6. Unauthorized Patient Data Access Prevention', () => {
    it('blocks patient from querying another patient’s recovery plan', async () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);
      const plan = await repository.getRecoveryPlan(UNAUTHORIZED_PATIENT_ID);
      expect(plan).toBeNull();
    });

    it('blocks patient from querying another patient’s exercise sessions', async () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);
      const sessions = await repository.getExerciseSessions(UNAUTHORIZED_PATIENT_ID);
      expect(sessions).toEqual([]);
    });

    it('blocks patient from querying another patient’s symptom check-ins', async () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);
      const checkins = await repository.getSymptomCheckins(UNAUTHORIZED_PATIENT_ID);
      expect(checkins).toEqual([]);
    });

    it('rejects patient attempting to save an exercise session under another patient ID', async () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);
      await expect(
        repository.saveExerciseSession({
          patient_id: UNAUTHORIZED_PATIENT_ID,
          plan_exercise_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          started_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
          duration_seconds: 120,
          repetitions: 10,
          status: 'completed',
          measurement_mode: 'camera_prototype',
        })
      ).rejects.toThrow(/Unauthorized/);
    });

    it('rejects patient attempting to save a symptom check-in under another patient ID', async () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);
      await expect(
        repository.saveSymptomCheckin({
          patient_id: UNAUTHORIZED_PATIENT_ID,
          pain_score: 5,
          symptoms: { swelling: true },
          notes: 'Attempted cross-patient spoofing',
        })
      ).rejects.toThrow(/Unauthorized/);
    });
  });

  describe('7. Unauthorized Clinician Data Access Prevention', () => {
    it('blocks clinician from querying an unassigned patient’s recovery plan', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);
      const plan = await repository.getRecoveryPlan(UNAUTHORIZED_PATIENT_ID);
      expect(plan).toBeNull();
    });

    it('blocks clinician from querying an unassigned patient’s exercise sessions', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);
      const sessions = await repository.getExerciseSessions(UNAUTHORIZED_PATIENT_ID);
      expect(sessions).toEqual([]);
    });

    it('blocks clinician from querying an unassigned patient’s symptom check-ins', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);
      const checkins = await repository.getSymptomCheckins(UNAUTHORIZED_PATIENT_ID);
      expect(checkins).toEqual([]);
    });

    it('blocks an unauthorized clinician from updating alerts for an unassigned patient', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);
      // Clinician ID c9999999... has no relationship with Eleanor Vance
      await expect(
        repository.updateAlertStatus(
          '44444444-4444-4444-4444-444444444444',
          'reviewed',
          UNAUTHORIZED_CLINICIAN_ID,
          'reviewed',
          'Attempted unauthorized review'
        )
      ).rejects.toThrow(/Unauthorized/);
    });
  });
});
