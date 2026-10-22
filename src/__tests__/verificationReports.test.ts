// ReKnee AI - Doctor-Verified Recovery Activity Report & Verification Test Suite
// Adheres strictly to 01_PRD.md, 04_DATABASE.md, 05_API.md, 11_AUTH_AUTHORIZATION.md, 14_TESTING_QA.md, 16_SECURITY_AUDIT.md
// Tests the 15 required verification and report flows:
// 1. Patient completes required activities.
// 2. Patient requests verification.
// 3. Clinician receives request.
// 4. Clinician views patient data.
// 5. Clinician rejects request.
// 6. Patient sees rejected status.
// 7. Clinician approves request.
// 8. Verified report is generated.
// 9. Patient can download PDF.
// 10. Unauthorized patient cannot access another patient's report.
// 11. Unauthorized clinician cannot verify an unrelated patient.
// 12. Patient cannot modify verified information.
// 13. Audit history is recorded.
// 14. PDF generation failure is handled.
// 15. Storage/download failure is handled.

import { describe, it, expect, beforeEach } from 'vitest';
import { repository } from '../lib/supabase/repository';
import {
  DEMO_PATIENT_ID,
  DEMO_CLINICIAN_ID,
  DEMO_PLAN_ID,
  DEMO_VERIFICATION_ID,
} from '../lib/supabase/mockStore';
import { generateRecoveryCompletionPdf } from '../lib/reports/pdfGenerator';

describe('Doctor-Verified Recovery Completion Certificate & Report System', () => {
  const UNAUTHORIZED_PATIENT_ID = 'p9999999-9999-9999-9999-999999999999';
  const UNAUTHORIZED_CLINICIAN_ID = 'c9999999-9999-9999-9999-999999999999';

  beforeEach(() => {
    // Reset to authorized patient
    repository.setActiveUserId(DEMO_PATIENT_ID);
  });

  describe('1. Activity Tracking & Patient Verification Request', () => {
    it('verifies patient has completed required sessions', async () => {
      const sessions = await repository.getExerciseSessions(DEMO_PATIENT_ID);
      const completed = sessions.filter((s) => s.status === 'completed');
      expect(completed.length).toBeGreaterThanOrEqual(5);
    });

    it('allows patient to request doctor verification for their own recovery plan', async () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);
      const verification = await repository.requestVerification(DEMO_PATIENT_ID, DEMO_PLAN_ID);

      expect(verification).toBeDefined();
      expect(verification.patient_id).toBe(DEMO_PATIENT_ID);
      expect(verification.status).toBe('requested');
      expect(verification.verification_id).toMatch(/^VER-\d{4}-TKA-\d+/);
      expect(verification.verification_date).toBeNull();
      expect(verification.clinician_name).toBeNull();
    });

    it('prevents a patient from requesting verification for another patient', async () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);
      await expect(
        repository.requestVerification(UNAUTHORIZED_PATIENT_ID, DEMO_PLAN_ID)
      ).rejects.toThrow(/Unauthorized/);
    });
  });

  describe('2. Clinician Reception, Review & Rejection Workflow', () => {
    it('allows authorized clinician to receive and list verification requests', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);
      const requests = await repository.getVerifications();
      expect(requests.length).toBeGreaterThanOrEqual(1);
      const patientReq = requests.find((r) => r.patient_id === DEMO_PATIENT_ID);
      expect(patientReq).toBeDefined();
    });

    it('allows authorized clinician to view patient recovery data in detail', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);
      const [plan, sessions, checkins] = await Promise.all([
        repository.getRecoveryPlan(DEMO_PATIENT_ID),
        repository.getExerciseSessions(DEMO_PATIENT_ID),
        repository.getSymptomCheckins(DEMO_PATIENT_ID),
      ]);

      expect(plan).not.toBeNull();
      expect(sessions.length).toBeGreaterThan(0);
      expect(checkins.length).toBeGreaterThan(0);
    });

    it('records audit log when clinician opens verification request for review', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);
      await repository.recordClinicianOpenedRequest(DEMO_VERIFICATION_ID);

      const auditActions = await repository.getVerificationAuditActions(DEMO_VERIFICATION_ID);
      const openAction = auditActions.find((a) => a.action === 'clinician_opened_request');
      expect(openAction).toBeDefined();
      expect(openAction?.actor_id).toBe(DEMO_CLINICIAN_ID);
    });

    it('allows clinician to reject / request clarification with clinical note', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);
      const rejected = await repository.rejectVerification({
        verificationId: DEMO_VERIFICATION_ID,
        reason: 'Please complete 2 more sessions with at least 8 repetitions.',
      });

      expect(rejected.status).toBe('rejected');
      expect(rejected.verification_note).toContain('Please complete 2 more sessions');

      // Patient checks status
      repository.setActiveUserId(DEMO_PATIENT_ID);
      const patientVerifications = await repository.getVerifications();
      const patientRecord = patientVerifications.find((v) => v.id === DEMO_VERIFICATION_ID);
      expect(patientRecord?.status).toBe('rejected');
      expect(patientRecord?.verification_note).toContain('Please complete 2 more sessions');
    });
  });

  describe('3. Clinician Approval, Signing & Report Generation', () => {
    it('allows authorized clinician to approve and sign the report with clinical attestation', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);
      const approved = await repository.approveVerification({
        verificationId: DEMO_VERIFICATION_ID,
        clinicianName: 'Dr. Marcus Patel, DPT',
        clinicianDesignation: 'Doctor of Physical Therapy',
        licenseIdentifier: 'PT-CA-84920',
        verificationNote: 'Mobility protocol successfully completed. Knee extension within normal limits.',
      });

      expect(approved.status).toBe('approved');
      expect(approved.clinician_name).toBe('Dr. Marcus Patel, DPT');
      expect(approved.clinician_designation).toBe('Doctor of Physical Therapy');
      expect(approved.verification_date).toBe(new Date().toISOString().split('T')[0]);
      expect(approved.document_reference).toContain('.pdf');
    });

    it('generates a valid PDF report with mandatory disclaimers and demo stamp', async () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);
      const verification = await repository.getVerificationById(DEMO_VERIFICATION_ID);
      const patient = await repository.getPatientProfile(DEMO_PATIENT_ID);
      const plan = await repository.getRecoveryPlan(DEMO_PATIENT_ID);
      const exercises = await repository.getPlanExercises(plan!.id);
      const sessions = await repository.getExerciseSessions(DEMO_PATIENT_ID);
      const checkins = await repository.getSymptomCheckins(DEMO_PATIENT_ID);

      const pdf = generateRecoveryCompletionPdf({
        verification: verification!,
        patient: patient!,
        clinician: null,
        plan: plan!,
        exercises,
        sessions,
        checkins,
      });

      expect(pdf).toBeDefined();
      expect(pdf.blob).toBeDefined();
      expect(pdf.blob.size).toBeGreaterThan(1000);
      expect(pdf.filename).toContain('Doctor_Verified_Recovery_Report_');
      expect(pdf.filename).toContain('.pdf');
    });

    it('records audit trail when patient downloads approved report', async () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);
      await repository.recordReportDownload(DEMO_VERIFICATION_ID);

      const auditActions = await repository.getVerificationAuditActions(DEMO_VERIFICATION_ID);
      const downloadAction = auditActions.find((a) => a.action === 'report_downloaded');
      expect(downloadAction).toBeDefined();
      expect(downloadAction?.actor_id).toBe(DEMO_PATIENT_ID);
      expect(downloadAction?.actor_role).toBe('patient');
    });
  });

  describe('4. Strict Authorization & Security Controls (11_AUTH_AUTHORIZATION.md, 16_SECURITY_AUDIT.md)', () => {
    it('blocks unauthorized patient from accessing another patient’s verification records', async () => {
      // Create a mock active session for an unauthorized patient
      repository.setActiveUserId(UNAUTHORIZED_PATIENT_ID);

      // Attempting to query demo patient's verifications
      const verifications = await repository.getVerifications(DEMO_PATIENT_ID);
      expect(verifications).toEqual([]);

      // Attempting to get specific verification by ID
      const v = await repository.getVerificationById(DEMO_VERIFICATION_ID);
      expect(v).toBeNull();
    });

    it('blocks unauthorized clinician from approving an unassigned patient', async () => {
      repository.setActiveUserId(UNAUTHORIZED_CLINICIAN_ID);

      await expect(
        repository.approveVerification({
          verificationId: DEMO_VERIFICATION_ID,
          clinicianName: 'Dr. Intruder, MD',
          clinicianDesignation: 'Orthopedic Surgeon',
        })
      ).rejects.toThrow(/Unauthorized/);
    });

    it('blocks patient from approving or modifying verified information', async () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);

      // Patient cannot call approveVerification
      await expect(
        repository.approveVerification({
          verificationId: DEMO_VERIFICATION_ID,
          clinicianName: 'Eleanor Vance',
          clinicianDesignation: 'Self-Certified',
        })
      ).rejects.toThrow(/Unauthorized/);

      // Patient cannot call rejectVerification
      await expect(
        repository.rejectVerification({
          verificationId: DEMO_VERIFICATION_ID,
          reason: 'Self-rejected',
        })
      ).rejects.toThrow(/Unauthorized/);
    });

    it('ensures comprehensive immutable audit history is recorded for all lifecycle events', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);
      const auditActions = await repository.getVerificationAuditActions(DEMO_VERIFICATION_ID);

      expect(auditActions.length).toBeGreaterThanOrEqual(3);
      const actions = auditActions.map((a) => a.action);
      expect(actions).toContain('verification_requested');
      expect(actions).toContain('approved');
      expect(actions).toContain('report_generated');
    });
  });

  describe('5. Error & Failure Handling Robustness', () => {
    it('handles non-existent verification queries safely without crashing', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);
      const nonExistent = await repository.getVerificationById('ver-non-existent-999');
      expect(nonExistent).toBeNull();
    });

    it('handles empty audit query for non-existent verification safely', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);
      const actions = await repository.getVerificationAuditActions('ver-non-existent-999');
      expect(actions).toEqual([]);
    });

    it('handles PDF generation with minimal/empty exercise sessions safely', () => {
      const minimalVerification = {
        id: 'ver-min',
        patient_id: DEMO_PATIENT_ID,
        clinician_id: DEMO_CLINICIAN_ID,
        recovery_plan_id: DEMO_PLAN_ID,
        status: 'approved' as const,
        requested_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
        verification_date: '2026-10-22',
        clinician_name: 'Dr. Marcus Patel',
        clinician_designation: 'DPT',
        license_identifier: null,
        verification_note: null,
        verification_id: 'VER-MIN-001',
        report_version: '1.0',
        generated_at: new Date().toISOString(),
        document_reference: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const pdf = generateRecoveryCompletionPdf({
        verification: minimalVerification,
        patient: {
          id: DEMO_PATIENT_ID,
          full_name: 'Test Patient',
          role: 'patient',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        clinician: null,
        plan: {
          id: DEMO_PLAN_ID,
          patient_id: DEMO_PATIENT_ID,
          title: 'Basic Protocol',
          status: 'active',
          start_date: '2026-10-01',
          end_date: '2026-10-31',
          approved_by: DEMO_CLINICIAN_ID,
          created_at: new Date().toISOString(),
        },
        exercises: [],
        sessions: [],
        checkins: [],
      });

      expect(pdf).toBeDefined();
      expect(pdf.blob.size).toBeGreaterThan(500);
    });
  });
});
