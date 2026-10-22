// ReKnee AI - Alert Engine Test Suite
// Strictly validates requirements in:
// - 01_PRD.md
// - 04_DATABASE.md
// - 05_API.md
// - 10_DATABASE_BACKEND.md
// - 14_TESTING_QA.md
// - 16_SECURITY_AUDIT.md

import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateCheckinAlert,
  evaluateSessionAlert,
  evaluateEngagementGap,
  isDuplicateAlert,
} from '../lib/alerts/rules';
import {
  CHECKIN_CLINICAL_RULES,
  SESSION_CLINICAL_RULES,
  ENGAGEMENT_RULES,
  updateClinicalRule,
  resetRulesToDefault,
} from '../lib/alerts/alertConfig';
import { SymptomCheckin, ExerciseSession, Alert } from '../types/database';
import { repository } from '../lib/supabase/repository';
import { DEMO_CLINICIAN_ID, DEMO_PATIENT_ID } from '../lib/supabase/mockStore';

describe('Alert Engine — Deterministic Rules & Clinical Boundaries', () => {
  beforeEach(() => {
    resetRulesToDefault();
    repository.setActiveUserId(DEMO_CLINICIAN_ID);
  });

  describe('1. Valid Alert Generation (All Required Fields)', async () => {
    it('creates a valid clinical alert with all required metadata fields', async () => {
      const checkin: SymptomCheckin = {
        id: 'chk-valid-01',
        patient_id: DEMO_PATIENT_ID,
        pain_score: 6,
        symptoms: { calf_pain: true, swelling: true },
        notes: 'Tightness in calf after afternoon walk',
        created_at: new Date().toISOString(),
      };

      const ruleResult = evaluateCheckinAlert(checkin);
      expect(ruleResult.shouldAlert).toBe(true);
      expect(ruleResult.category).toBe('clinical_review');
      expect(ruleResult.severity).toBe('urgent');

      // Create alert through repository
      const alert = await repository.createAlert({
        patient_id: checkin.patient_id,
        category: ruleResult.category!,
        severity: ruleResult.severity!,
        source_type: 'symptom_checkin',
        source_id: checkin.id,
        reason: ruleResult.reason!,
        status: 'new',
        reviewed_at: null,
        reviewed_by: null,
      });

      // Verify every required field from 04_DATABASE.md
      expect(alert.id).toBeDefined();
      expect(alert.patient_id).toBe(DEMO_PATIENT_ID);
      expect(alert.source_type).toBe('symptom_checkin');
      expect(alert.source_id).toBe('chk-valid-01');
      expect(alert.category).toBe('clinical_review');
      expect(alert.severity).toBe('urgent');
      expect(alert.reason).toContain('DVT precaution');
      expect(alert.status).toBe('new');
      expect(alert.created_at).toBeDefined();
      expect(alert.reviewed_at).toBeNull();
      expect(alert.reviewed_by).toBeNull();
    });
  });

  describe('2. No Alert (Expected Normal Post-Op Recovery)', () => {
    it('does not trigger clinical alert for expected mild post-op symptoms', () => {
      const checkin: SymptomCheckin = {
        id: 'chk-normal-01',
        patient_id: DEMO_PATIENT_ID,
        pain_score: 3,
        symptoms: { stiffness: true, swelling: true },
        notes: 'Morning stiffness after sleeping, expected discomfort',
        created_at: new Date().toISOString(),
      };

      const result = evaluateCheckinAlert(checkin);
      expect(result.shouldAlert).toBe(false);
      expect(result.category).toBeUndefined();
      expect(result.ruleId).toBeUndefined();
    });

    it('does not trigger session alert when exercise is completed normally', () => {
      const session: ExerciseSession = {
        id: 'sess-normal-01',
        patient_id: DEMO_PATIENT_ID,
        plan_exercise_id: 'ex-01',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 180,
        repetitions: 10,
        status: 'completed',
        measurement_mode: 'camera_prototype',
        created_at: new Date().toISOString(),
      };

      const result = evaluateSessionAlert(session);
      expect(result.shouldAlert).toBe(false);
    });

    it('does not trigger engagement alert when activity is recent (<48 hours)', () => {
      const fiveHoursAgo = new Date(Date.now() - 5 * 3600000);
      const result = evaluateEngagementGap(fiveHoursAgo);
      expect(result.shouldAlert).toBe(false);
    });
  });

  describe('3. Duplicate Alert Prevention (Alert Fatigue Defense)', () => {
    it('detects duplicate alerts for same source event within 24h window', () => {
      const existingAlerts: Alert[] = [
        {
          id: 'alt-dup-1',
          patient_id: 'p1',
          category: 'clinical_review',
          severity: 'urgent',
          source_type: 'symptom_checkin',
          source_id: 'chk-dup-source-1',
          reason: 'Patient reported severe acute pain score (8/10)',
          status: 'new',
          created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
          reviewed_at: null,
          reviewed_by: null,
        },
      ];

      const duplicateAttempt: Partial<Alert> = {
        patient_id: 'p1',
        source_id: 'chk-dup-source-1',
        reason: 'Patient reported severe acute pain score (8/10)',
      };

      expect(isDuplicateAlert(existingAlerts, duplicateAttempt)).toBe(true);
    });

    it('allows alert for different source events or different patients', () => {
      const existingAlerts: Alert[] = [
        {
          id: 'alt-dup-2',
          patient_id: 'p1',
          category: 'clinical_review',
          severity: 'urgent',
          source_type: 'symptom_checkin',
          source_id: 'chk-dup-source-1',
          reason: 'Patient reported severe acute pain score (8/10)',
          status: 'new',
          created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
          reviewed_at: null,
          reviewed_by: null,
        },
      ];

      const distinctAttempt: Partial<Alert> = {
        patient_id: 'p1',
        source_id: 'chk-dup-source-2', // Distinct check-in
        reason: 'Different symptom incident',
      };

      expect(isDuplicateAlert(existingAlerts, distinctAttempt)).toBe(false);
    });
  });

  describe('4. Engagement Reminders vs Clinical Separation', () => {
    it('triggers engagement reminder when no recovery activity for over 48 hours', () => {
      const twoDaysAgo = new Date(Date.now() - 50 * 3600000);
      const result = evaluateEngagementGap(twoDaysAgo);

      expect(result.shouldAlert).toBe(true);
      // Strictly 'engagement' category — NEVER 'clinical_review'
      expect(result.category).toBe('engagement');
      // Severity must be non-critical
      expect(result.severity).toBe('moderate');
      expect(result.reason).toContain('No recovery activity recorded');
    });

    it('ensures missed exercise sessions or inactivity are NEVER classified as emergencies', () => {
      // Review all engagement rules
      for (const rule of ENGAGEMENT_RULES) {
        expect(rule.category).toBe('engagement');
        expect(rule.severity).not.toBe('critical');
        expect(rule.severity).not.toBe('urgent');
      }

      // Early stopped session rule must be moderate, not emergency
      const earlyStopRule = SESSION_CLINICAL_RULES.find((r) => r.id === 'CR-010');
      expect(earlyStopRule?.severity).toBe('moderate');
      expect(earlyStopRule?.severity).not.toBe('critical');
    });
  });

  describe('5. Clinical Escalation Alerts (Deterministic Rule-Based)', () => {
    it('triggers critical alert when red-flag chest pain / shortness of breath is reported', () => {
      const checkin: SymptomCheckin = {
        id: 'chk-redflag-01',
        patient_id: 'p1',
        pain_score: 2,
        symptoms: { chest_pain_shortness_breath: true },
        notes: 'Feeling sudden shortness of breath',
        created_at: new Date().toISOString(),
      };

      const result = evaluateCheckinAlert(checkin);
      expect(result.shouldAlert).toBe(true);
      expect(result.category).toBe('clinical_review');
      expect(result.severity).toBe('critical');
      expect(result.reason).toContain('CRITICAL RED-FLAG');
    });

    it('triggers urgent alert when severe acute pain is 8 or higher', () => {
      const checkin: SymptomCheckin = {
        id: 'chk-pain-01',
        patient_id: 'p1',
        pain_score: 9,
        symptoms: {},
        notes: 'Severe sharp throbbing',
        created_at: new Date().toISOString(),
      };

      const result = evaluateCheckinAlert(checkin);
      expect(result.shouldAlert).toBe(true);
      expect(result.category).toBe('clinical_review');
      expect(result.severity).toBe('urgent');
      expect(result.reason).toContain('severe acute pain score');
    });

    it('triggers urgent alert when wound infection signs (fever + warmth) appear', () => {
      const checkin: SymptomCheckin = {
        id: 'chk-infect-01',
        patient_id: 'p1',
        pain_score: 4,
        symptoms: { fever: true, warmth: true },
        notes: 'Temperature 101F, knee feels hot',
        created_at: new Date().toISOString(),
      };

      const result = evaluateCheckinAlert(checkin);
      expect(result.shouldAlert).toBe(true);
      expect(result.category).toBe('clinical_review');
      expect(result.severity).toBe('urgent');
      expect(result.reason).toContain('Potential wound complication');
    });
  });

  describe('6. Clinician Acknowledgement & Review Actions', () => {
    it('allows authorized clinician to acknowledge an alert and updates status', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);

      const alert = await repository.createAlert({
        patient_id: DEMO_PATIENT_ID,
        category: 'clinical_review',
        severity: 'urgent',
        source_type: 'symptom_checkin',
        source_id: 'chk-ack-01',
        reason: 'Patient reported acute discomfort',
        status: 'new',
        reviewed_at: null,
        reviewed_by: null,
      });

      expect(alert.status).toBe('new');

      const acknowledged = await repository.acknowledgeAlert(
        alert.id,
        DEMO_CLINICIAN_ID,
        'Clinician acknowledged alert and scheduled review call.'
      );

      expect(acknowledged).not.toBeNull();
      expect(acknowledged?.status).toBe('acknowledged');
      expect(acknowledged?.reviewed_by).toBe(DEMO_CLINICIAN_ID);
      expect(acknowledged?.reviewed_at).toBeDefined();
    });

    it('allows authorized clinician to mark an alert reviewed with follow-up action', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);

      const alert = await repository.createAlert({
        patient_id: DEMO_PATIENT_ID,
        category: 'clinical_review',
        severity: 'urgent',
        source_type: 'symptom_checkin',
        source_id: 'chk-rev-01',
        reason: 'Patient reported elevated swelling',
        status: 'new',
        reviewed_at: null,
        reviewed_by: null,
      });

      const reviewed = await repository.reviewAlert(
        alert.id,
        DEMO_CLINICIAN_ID,
        'Contacted Patient — Reviewed Symptoms',
        'Instructed patient to elevate leg above heart and apply ice 20 min.'
      );

      expect(reviewed).not.toBeNull();
      expect(reviewed?.status).toBe('reviewed');
      expect(reviewed?.reviewed_by).toBe(DEMO_CLINICIAN_ID);
    });
  });

  describe('7. Unauthorized Access Prevention (16_SECURITY_AUDIT.md)', () => {
    it('blocks a patient from modifying alert review status', async () => {
      repository.setActiveUserId(DEMO_PATIENT_ID);

      const alert = await repository.createAlert({
        patient_id: DEMO_PATIENT_ID,
        category: 'clinical_review',
        severity: 'urgent',
        source_type: 'symptom_checkin',
        source_id: 'chk-sec-01',
        reason: 'Test alert',
        status: 'new',
        reviewed_at: null,
        reviewed_by: null,
      });

      // Patient attempting to sign off an alert must be blocked
      await expect(
        repository.updateAlertStatus(
          alert.id,
          'reviewed',
          DEMO_PATIENT_ID,
          'Patient trying to clear alert'
        )
      ).rejects.toThrow('Unauthorized: Only clinicians can review or update alerts.');
    });

    it('blocks a clinician from reviewing an alert for an unassigned patient', async () => {
      const unauthorizedClinicianId = 'c9999999-9999-9999-9999-999999999999';

      // Mock profile for unauthorized clinician
      repository.setActiveUserId(DEMO_CLINICIAN_ID);

      const alert = await repository.createAlert({
        patient_id: DEMO_PATIENT_ID,
        category: 'clinical_review',
        severity: 'urgent',
        source_type: 'symptom_checkin',
        source_id: 'chk-unauth-01',
        reason: 'Test unassigned clinician access',
        status: 'new',
        reviewed_at: null,
        reviewed_by: null,
      });

      await expect(
        repository.updateAlertStatus(
          alert.id,
          'reviewed',
          unauthorizedClinicianId,
          'Attempted unassigned review'
        )
      ).rejects.toThrow('Unauthorized: Clinician is not authorized to act on this patient’s alerts.');
    });
  });

  describe('8. Audit Trail in alert_actions (04_DATABASE.md, 10_DATABASE_BACKEND.md)', () => {
    it('creates an immutable audit trail entry in alert_actions upon clinician action', async () => {
      repository.setActiveUserId(DEMO_CLINICIAN_ID);

      const alert = await repository.createAlert({
        patient_id: DEMO_PATIENT_ID,
        category: 'clinical_review',
        severity: 'urgent',
        source_type: 'symptom_checkin',
        source_id: 'chk-audit-01',
        reason: 'Patient reported acute calf discomfort',
        status: 'new',
        reviewed_at: null,
        reviewed_by: null,
      });

      // 1. Clinician acknowledges
      await repository.acknowledgeAlert(
        alert.id,
        DEMO_CLINICIAN_ID,
        'Triaged. Nurse follow-up scheduled.'
      );

      // 2. Clinician records follow-up consultation
      await repository.reviewAlert(
        alert.id,
        DEMO_CLINICIAN_ID,
        'Telehealth Consultation Scheduled for In-depth Mobility Exam',
        'Spoke with Eleanor. Swelling is stable, no warmth. Directed to rest.'
      );

      // Retrieve audit actions
      const auditTrail = await repository.getAlertActions(alert.id);

      expect(auditTrail.length).toBe(2);

      // Verify fields of audit trail entries
      const reviewAction = auditTrail.find((a) => a.action.includes('Telehealth Consultation'));
      expect(reviewAction).toBeDefined();
      expect(reviewAction?.alert_id).toBe(alert.id);
      expect(reviewAction?.clinician_id).toBe(DEMO_CLINICIAN_ID);
      expect(reviewAction?.notes).toContain('Spoke with Eleanor');
      expect(reviewAction?.created_at).toBeDefined();

      const ackAction = auditTrail.find((a) => a.action === 'acknowledged');
      expect(ackAction).toBeDefined();
      expect(ackAction?.notes).toContain('Triaged. Nurse follow-up scheduled.');
    });
  });

  describe('9. Transparent Rules Configuration Module', () => {
    it('allows updating rule thresholds without modifying application source code', () => {
      // Initial pain threshold is 8
      const painRule = CHECKIN_CLINICAL_RULES.find((r) => r.id === 'CR-003');
      expect(painRule?.minPainScore).toBe(8);

      // Clinical team customizes threshold to 7 for sensitive monitoring
      const updated = updateClinicalRule('CR-003', { minPainScore: 7 });
      expect(updated).toBe(true);

      const checkin: SymptomCheckin = {
        id: 'chk-config-01',
        patient_id: 'p1',
        pain_score: 7,
        symptoms: {},
        notes: 'Pain level 7',
        created_at: new Date().toISOString(),
      };

      // Now triggers at 7 because rule was updated dynamically
      const result = evaluateCheckinAlert(checkin);
      expect(result.shouldAlert).toBe(true);
      expect(result.ruleId).toBe('CR-003');

      // Reset back to baseline
      resetRulesToDefault();
      expect(CHECKIN_CLINICAL_RULES.find((r) => r.id === 'CR-003')?.minPainScore).toBe(8);
    });

    it('allows disabling a rule without code changes', () => {
      // Disable CR-003
      updateClinicalRule('CR-003', { enabled: false });

      const checkin: SymptomCheckin = {
        id: 'chk-disabled-01',
        patient_id: 'p1',
        pain_score: 9,
        symptoms: {},
        notes: 'Pain level 9',
        created_at: new Date().toISOString(),
      };

      const result = evaluateCheckinAlert(checkin);
      // Since CR-003 was disabled and no symptoms are present, no alert triggers
      expect(result.shouldAlert).toBe(false);

      resetRulesToDefault();
    });
  });
});
