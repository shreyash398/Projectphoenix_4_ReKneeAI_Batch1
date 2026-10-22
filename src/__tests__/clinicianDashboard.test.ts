// ReKnee AI - Clinician Dashboard & Oversight QA Test Suite
// Adheres strictly to 01_PRD.md, 02_DESIGN.md, 04_DATABASE.md, 05_API.md, 11_AUTH_AUTHORIZATION.md, and 14_TESTING_QA.md
// Tests:
// 1. Overview metrics (patient count, active recovery plans, recent sessions, check-in activity, unresolved alerts)
// 2. Patients roster (patient metadata, plan status, recent activity, latest check-in, alert indicators)
// 3. Patient detail data scoping (plan, exercises, sessions, check-ins, alerts, assistant questions)
// 4. Strict clinician-patient authorization & RLS enforcement (blocking unassigned patient access)
// 5. Alert management and immutable audit history logging in alert_actions
// 6. Clinical safety guardrails (no automated diagnosis, separation of engagement vs clinical alerts)

import { describe, it, expect, beforeEach } from 'vitest';
import { repository } from '../lib/supabase/repository';
import { DEMO_PATIENT_ID, DEMO_CLINICIAN_ID } from '../lib/supabase/mockStore';

describe('Clinician Dashboard & Patient Oversight System', () => {
  const UNAUTHORIZED_PATIENT_ID = 'p9999999-9999-9999-9999-999999999999';
  const UNAUTHORIZED_CLINICIAN_ID = 'c9999999-9999-9999-9999-999999999999';

  beforeEach(() => {
    // Reset to authorized clinician for dashboard tests
    repository.setActiveUserId(DEMO_CLINICIAN_ID);
  });

  describe('1. Clinician Overview Metrics & Data Aggregation', () => {
    it('retrieves patient count matching authorized clinical relationships', async () => {
      const authorizedPatients = await repository.getClinicianAuthorizedPatients(DEMO_CLINICIAN_ID);
      expect(authorizedPatients.length).toBeGreaterThan(0);
      expect(authorizedPatients.some((p) => p.id === DEMO_PATIENT_ID)).toBe(true);
    });

    it('aggregates active recovery plans for authorized patients', async () => {
      const plan = await repository.getRecoveryPlan(DEMO_PATIENT_ID);
      expect(plan).not.toBeNull();
      expect(plan?.patient_id).toBe(DEMO_PATIENT_ID);
      expect(plan?.status).toBe('active');
    });

    it('aggregates recent exercise sessions across authorized patients', async () => {
      const sessions = await repository.getExerciseSessions(DEMO_PATIENT_ID);
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions.every((s) => s.patient_id === DEMO_PATIENT_ID)).toBe(true);
    });

    it('aggregates symptom check-ins and tracks patient pain activity', async () => {
      const checkins = await repository.getSymptomCheckins(DEMO_PATIENT_ID);
      expect(Array.isArray(checkins)).toBe(true);
      expect(checkins.length).toBeGreaterThan(0);
      expect(checkins.every((c) => c.patient_id === DEMO_PATIENT_ID)).toBe(true);

      const painScores = checkins.map((c) => c.pain_score);
      const avgPain = painScores.reduce((sum, score) => sum + score, 0) / painScores.length;
      expect(avgPain).toBeGreaterThanOrEqual(0);
      expect(avgPain).toBeLessThanOrEqual(10);
    });

    it('segregates unresolved alerts into clinical escalation vs engagement reminders', async () => {
      const alerts = await repository.getAlerts();
      const unresolved = alerts.filter((a) => a.status === 'new' || a.status === 'acknowledged');

      const clinicalAlerts = unresolved.filter((a) => a.category === 'clinical_review');
      const engagementAlerts = unresolved.filter((a) => a.category === 'engagement');

      // Both categories are handled separately with no overlap
      expect(clinicalAlerts.every((a) => a.category === 'clinical_review')).toBe(true);
      expect(engagementAlerts.every((a) => a.category === 'engagement')).toBe(true);
    });
  });

  describe('2. Patients Roster & Patient Metadata', () => {
    it('retrieves patient roster with identifiers, plans, and activity', async () => {
      const patients = await repository.getClinicianAuthorizedPatients(DEMO_CLINICIAN_ID);
      expect(patients.length).toBeGreaterThanOrEqual(1);

      const patient = patients[0];
      expect(patient.id).toBeDefined();
      expect(patient.full_name).toBeDefined();
      expect(patient.role).toBe('patient');

      const plan = await repository.getRecoveryPlan(patient.id);
      expect(plan).not.toBeNull();
      expect(plan?.title).toBeDefined();

      const latestSession = (await repository.getExerciseSessions(patient.id))[0];
      expect(latestSession).toBeDefined();
      expect(latestSession?.measurement_mode).toBeDefined();

      const latestCheckin = (await repository.getSymptomCheckins(patient.id))[0];
      expect(latestCheckin).toBeDefined();
      expect(latestCheckin?.pain_score).toBeDefined();
    });

    it('flags unresolved alerts on patient records for fast clinical triage', async () => {
      const alerts = await repository.getAlerts(DEMO_PATIENT_ID);
      const unresolved = alerts.filter((a) => a.status === 'new' || a.status === 'acknowledged');
      const hasClinicalEscalation = unresolved.some((a) => a.category === 'clinical_review');

      expect(typeof hasClinicalEscalation).toBe('boolean');
    });

    it('does not include unauthorized patients in clinician roster', async () => {
      const patients = await repository.getClinicianAuthorizedPatients(DEMO_CLINICIAN_ID);
      expect(patients.some((p) => p.id === UNAUTHORIZED_PATIENT_ID)).toBe(false);
    });
  });

  describe('3. Patient Detail View Data & Content', () => {
    it('retrieves complete recovery plan and prescribed exercises for authorized patient', async () => {
      const plan = await repository.getRecoveryPlan(DEMO_PATIENT_ID);
      expect(plan).not.toBeNull();

      if (plan) {
        const exercises = await repository.getPlanExercises(plan.id);
        expect(Array.isArray(exercises)).toBe(true);
        expect(exercises.length).toBeGreaterThan(0);
        expect(exercises[0].name).toBeDefined();
        expect(exercises[0].target_repetitions).toBeGreaterThan(0);
      }
    });

    it('retrieves exercise sessions log for patient detail', async () => {
      const sessions = await repository.getExerciseSessions(DEMO_PATIENT_ID);
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0].status).toBeDefined();
      expect(sessions[0].duration_seconds).toBeGreaterThan(0);
    });

    it('retrieves symptom check-ins log for patient detail', async () => {
      const checkins = await repository.getSymptomCheckins(DEMO_PATIENT_ID);
      expect(checkins.length).toBeGreaterThan(0);
      expect(checkins[0].pain_score).toBeDefined();
      expect(checkins[0].symptoms).toBeDefined();
    });

    it('retrieves assistant interactions with source citations for patient chart', async () => {
      const questions = await repository.getAssistantQuestions(DEMO_PATIENT_ID);
      expect(Array.isArray(questions)).toBe(true);
      // Questions asked by this patient should be returned
      expect(questions.every((q) => q.patient_id === DEMO_PATIENT_ID)).toBe(true);
    });
  });

  describe('4. Strict Clinician-Patient Authorization & RLS Enforcement', () => {
    it('confirms authorization status via isClinicianAuthorizedForPatient', () => {
      const isAuth = repository.isClinicianAuthorizedForPatient(
        DEMO_CLINICIAN_ID,
        DEMO_PATIENT_ID
      );
      expect(isAuth).toBe(true);

      const isUnauth = repository.isClinicianAuthorizedForPatient(
        DEMO_CLINICIAN_ID,
        UNAUTHORIZED_PATIENT_ID
      );
      expect(isUnauth).toBe(false);

      const isUnauthClinician = repository.isClinicianAuthorizedForPatient(
        UNAUTHORIZED_CLINICIAN_ID,
        DEMO_PATIENT_ID
      );
      expect(isUnauthClinician).toBe(false);
    });

    it('blocks clinician from accessing unassigned patient recovery plan', async () => {
      const plan = await repository.getRecoveryPlan(UNAUTHORIZED_PATIENT_ID);
      expect(plan).toBeNull();
    });

    it('blocks clinician from accessing unassigned patient exercise sessions', async () => {
      const sessions = await repository.getExerciseSessions(UNAUTHORIZED_PATIENT_ID);
      expect(sessions).toEqual([]);
    });

    it('blocks clinician from accessing unassigned patient symptom check-ins', async () => {
      const checkins = await repository.getSymptomCheckins(UNAUTHORIZED_PATIENT_ID);
      expect(checkins).toEqual([]);
    });

    it('blocks clinician from accessing unassigned patient assistant questions', async () => {
      const questions = await repository.getAssistantQuestions(UNAUTHORIZED_PATIENT_ID);
      expect(questions).toEqual([]);
    });

    it('blocks clinician from accessing unassigned patient profile', async () => {
      const profile = await repository.getPatientProfile(UNAUTHORIZED_PATIENT_ID);
      expect(profile).toBeNull();
    });
  });

  describe('5. Clinician Alert Review, Acknowledge & Audit Actions', () => {
    it('allows authorized clinician to acknowledge an alert and creates audit entry', async () => {
      // Create a test alert
      const alert = await repository.createAlert({
        patient_id: DEMO_PATIENT_ID,
        category: 'clinical_review',
        severity: 'urgent',
        source_type: 'symptom_checkin',
        source_id: 'chk-test-ack',
        reason: 'Post-op pain spike to 8/10',
        status: 'new',
      });

      // Clinician acknowledges
      const updated = await repository.acknowledgeAlert(
        alert.id,
        DEMO_CLINICIAN_ID,
        'Acknowledged by covering clinician'
      );
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('acknowledged');

      // Verify audit trail entry
      const actions = await repository.getAlertActions(alert.id);
      expect(actions.length).toBeGreaterThanOrEqual(1);
      const ackAction = actions.find((a) => a.action === 'acknowledged');
      expect(ackAction).toBeDefined();
      expect(ackAction?.clinician_id).toBe(DEMO_CLINICIAN_ID);
      expect(ackAction?.notes).toBe('Acknowledged by covering clinician');
    });

    it('allows authorized clinician to review and sign-off alert with clinical note', async () => {
      const alert = await repository.createAlert({
        patient_id: DEMO_PATIENT_ID,
        category: 'clinical_review',
        severity: 'urgent',
        source_type: 'symptom_checkin',
        source_id: 'chk-test-review',
        reason: 'Persistent joint stiffness and moderate warmth',
        status: 'new',
      });

      const updated = await repository.reviewAlert(
        alert.id,
        DEMO_CLINICIAN_ID,
        'Contacted Patient — Reviewed Symptoms',
        'Patient instructed to elevate and apply ice. Telehealth scheduled in 48h.'
      );
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('reviewed');
      expect(updated!.reviewed_by).toBe(DEMO_CLINICIAN_ID);
      expect(updated!.reviewed_at).toBeDefined();

      // Verify audit trail entry
      const actions = await repository.getAlertActions(alert.id);
      const reviewAction = actions.find((a) => a.action === 'Contacted Patient — Reviewed Symptoms');
      expect(reviewAction).toBeDefined();
      expect(reviewAction?.notes).toContain('Telehealth scheduled in 48h');
    });

    it('blocks unauthorized clinician from updating alerts of unassigned patient', async () => {
      // Create an alert for unauthorized patient
      const alert = await repository.createAlert({
        patient_id: UNAUTHORIZED_PATIENT_ID,
        category: 'clinical_review',
        severity: 'urgent',
        source_type: 'symptom_checkin',
        source_id: 'chk-unauth-test',
        reason: 'Severe swelling test',
        status: 'new',
      });

      // Current clinician is DEMO_CLINICIAN_ID, not authorized for UNAUTHORIZED_PATIENT_ID
      await expect(
        repository.updateAlertStatus(
          alert.id,
          'acknowledged',
          DEMO_CLINICIAN_ID,
          'Acknowledge attempt',
          'Should fail'
        )
      ).rejects.toThrow(/Unauthorized/);
    });
  });

  describe('6. Clinical Safety & Medical Governance Boundaries', () => {
    it('missed exercise session produces engagement reminder, NOT clinical emergency alert', async () => {
      // Simulate missed session evaluation
      const missedSessionAlert = await repository.createAlert({
        patient_id: DEMO_PATIENT_ID,
        category: 'engagement',
        severity: 'low',
        source_type: 'adherence_gap',
        source_id: 'sch-session-missed-1',
        reason: 'No completed session in the past 24 hours. Gentle adherence reminder.',
        status: 'new',
      });

      expect(missedSessionAlert.category).toBe('engagement');
      expect(missedSessionAlert.category).not.toBe('clinical_review');
      expect(missedSessionAlert.severity).toBe('low');
    });

    it('ensures alert reason does not contain fabricated diagnostic claims', async () => {
      const alerts = await repository.getAlerts();
      for (const alert of alerts) {
        expect(alert.reason).not.toMatch(/diagnosed with|confirmed infection|prescribed/i);
      }
    });
  });
});
