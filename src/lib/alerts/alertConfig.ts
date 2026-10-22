// ReKnee AI — Transparent Alert Configuration
// =============================================
// This module contains ALL configurable alert rules and thresholds.
// Clinical teams can review and modify these values without rewriting application code.
//
// IMPORTANT:
// - These thresholds are DEMONSTRATION configurations for the MVP.
// - They MUST be reviewed and approved by qualified clinicians before any real clinical use.
// - No LLM is used to determine whether an alert should be clinically escalated.
// - A missed exercise session is NOT automatically a medical emergency.
// - Engagement reminders NEVER appear as clinical danger alerts.

import { AlertSeverity } from '../../types/database';

// ──────────────────────────────────────────────
// 1. CLINICAL ESCALATION RULE DEFINITIONS
// ──────────────────────────────────────────────
// These rules trigger 'clinical_review' alerts that require clinician attention.

export interface ClinicalRule {
  /** Unique rule identifier for audit trail */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** What this rule detects */
  description: string;
  /** Alert category — always 'clinical_review' for clinical rules */
  category: 'clinical_review';
  /** Severity level assigned when this rule triggers */
  severity: AlertSeverity;
  /** Whether this rule is currently active */
  enabled: boolean;
  /** Source that generated the configuration (for audit) */
  configSource: string;
  /** Version of this rule configuration */
  version: string;
}

export interface CheckinClinicalRule extends ClinicalRule {
  type: 'checkin';
  /** Symptom keys that trigger this rule */
  triggerSymptoms?: string[];
  /** Minimum pain score to trigger (inclusive), or null if pain is not a factor */
  minPainScore?: number | null;
  /** Additional symptom that must also be present (AND condition) */
  requiredCoSymptoms?: string[];
  /** Reason template — {pain_score} placeholder available */
  reasonTemplate: string;
}

export interface SessionClinicalRule extends ClinicalRule {
  type: 'session';
  /** Session status that triggers this rule */
  triggerStatus: string;
  /** Maximum repetitions threshold (below this triggers) */
  maxRepetitions: number;
  /** Reason template — {repetitions} placeholder available */
  reasonTemplate: string;
}

// ──────────────────────────────────────────────
// 2. ENGAGEMENT REMINDER RULE DEFINITIONS
// ──────────────────────────────────────────────
// These rules trigger 'engagement' alerts — friendly reminders, NOT clinical danger.

export interface EngagementRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** What this rule detects */
  description: string;
  /** Alert category — always 'engagement' */
  category: 'engagement';
  /** Severity level — should be 'low' or 'moderate', NEVER 'critical' or 'urgent' */
  severity: 'low' | 'moderate';
  /** Whether this rule is currently active */
  enabled: boolean;
  /** Hours since last activity to trigger */
  inactivityHoursThreshold: number;
  /** Reason template — {hours} placeholder available */
  reasonTemplate: string;
  /** Source that generated the configuration */
  configSource: string;
  /** Version of this rule configuration */
  version: string;
}

// ──────────────────────────────────────────────
// 3. CONFIGURED RULES — REVIEW AND MODIFY HERE
// ──────────────────────────────────────────────

const INITIAL_CHECKIN_CLINICAL_RULES: CheckinClinicalRule[] = [
  {
    id: 'CR-001',
    name: 'Red-Flag Emergency: Chest Pain / Difficulty Breathing',
    description: 'Patient reports chest pain or shortness of breath — potential PE indicator requiring immediate emergency care.',
    type: 'checkin',
    category: 'clinical_review',
    severity: 'critical',
    enabled: true,
    triggerSymptoms: ['chest_pain_shortness_breath'],
    minPainScore: null, // Any pain score triggers
    reasonTemplate: 'CRITICAL RED-FLAG: Patient reported chest pain or shortness of breath. Immediate emergency care advised. [Rule: CR-001]',
    configSource: 'Emergency Escalation Guidelines for Orthopedic Patients v1.0',
    version: '1.0.0',
  },
  {
    id: 'CR-002',
    name: 'DVT Precaution: Calf Pain with Elevated Pain or Swelling',
    description: 'Patient reports calf pain/tightness combined with pain ≥5 or swelling — potential DVT indicator.',
    type: 'checkin',
    category: 'clinical_review',
    severity: 'urgent',
    enabled: true,
    triggerSymptoms: ['calf_pain'],
    minPainScore: 5,
    requiredCoSymptoms: ['swelling'], // Either pain ≥5 OR swelling present
    reasonTemplate: 'Patient reported calf pain/tightness with pain score {pain_score}/10. Recommended review for DVT precaution. [Rule: CR-002]',
    configSource: 'Post-Surgical DVT Screening Protocol v2.0',
    version: '1.0.0',
  },
  {
    id: 'CR-003',
    name: 'Severe Acute Pain',
    description: 'Patient reports pain score ≥8 — exceeds configured post-operative comfort threshold.',
    type: 'checkin',
    category: 'clinical_review',
    severity: 'urgent',
    enabled: true,
    triggerSymptoms: [],
    minPainScore: 8,
    reasonTemplate: 'Patient reported severe acute pain score ({pain_score}/10) exceeding configured post-op comfort threshold. [Rule: CR-003]',
    configSource: 'Post-Op Pain Management Guidelines v1.4',
    version: '1.0.0',
  },
  {
    id: 'CR-004',
    name: 'Infection Watch: Fever with Redness or Warmth',
    description: 'Patient reports fever combined with localized redness or warmth — potential wound complication.',
    type: 'checkin',
    category: 'clinical_review',
    severity: 'urgent',
    enabled: true,
    triggerSymptoms: ['fever'],
    minPainScore: null,
    requiredCoSymptoms: ['redness', 'warmth'], // fever AND (redness OR warmth)
    reasonTemplate: 'Potential wound complication: Patient reported fever combined with localized redness or warmth. [Rule: CR-004]',
    configSource: 'Post-Surgical Wound Management Standards v3.0',
    version: '1.0.0',
  },
];

const INITIAL_SESSION_CLINICAL_RULES: SessionClinicalRule[] = [
  {
    id: 'CR-010',
    name: 'Exercise Stopped Early with Low Repetitions',
    description: 'Patient stopped exercise session very early with fewer than the configured rep threshold — may indicate acute discomfort.',
    type: 'session',
    category: 'clinical_review',
    severity: 'moderate', // NOT urgent or critical — this is NOT an emergency
    enabled: true,
    triggerStatus: 'stopped_early',
    maxRepetitions: 3, // Below this threshold triggers
    reasonTemplate: 'Exercise stopped early after only {repetitions} repetitions. Patient may be experiencing discomfort. [Rule: CR-010]',
    configSource: 'Rehabilitation Progress Monitoring Configuration v1.0',
    version: '1.0.0',
  },
];

const INITIAL_ENGAGEMENT_RULES: EngagementRule[] = [
  {
    id: 'ER-001',
    name: 'Extended Inactivity: No Activity for 48+ Hours',
    description: 'No exercise sessions or check-ins recorded in the past 48 hours. Friendly adherence reminder.',
    category: 'engagement',
    severity: 'moderate',
    enabled: true,
    inactivityHoursThreshold: 48,
    reasonTemplate: 'Adherence notice: No recovery activity recorded in the past {hours} hours. Friendly check-in recommended. [Rule: ER-001]',
    configSource: 'Patient Engagement Configuration v1.0',
    version: '1.0.0',
  },
  {
    id: 'ER-002',
    name: 'Welcome: No Activity Recorded Yet',
    description: 'Patient has no exercise sessions or check-ins at all. Welcome/onboarding reminder.',
    category: 'engagement',
    severity: 'low',
    enabled: true,
    inactivityHoursThreshold: 0, // Special: triggers when lastActivity is null
    reasonTemplate: 'Welcome: No exercise sessions or check-ins recorded yet. [Rule: ER-002]',
    configSource: 'Patient Engagement Configuration v1.0',
    version: '1.0.0',
  },
];

// Active in-memory rule arrays (can be modified by clinical config methods below)
export let CHECKIN_CLINICAL_RULES: CheckinClinicalRule[] = JSON.parse(
  JSON.stringify(INITIAL_CHECKIN_CLINICAL_RULES)
);

export let SESSION_CLINICAL_RULES: SessionClinicalRule[] = JSON.parse(
  JSON.stringify(INITIAL_SESSION_CLINICAL_RULES)
);

export let ENGAGEMENT_RULES: EngagementRule[] = JSON.parse(
  JSON.stringify(INITIAL_ENGAGEMENT_RULES)
);

/**
 * DUPLICATE PREVENTION CONFIGURATION
 */
export const DUPLICATE_PREVENTION = {
  /** Hours within which an alert with the same source_id is considered a duplicate */
  sameSourceWindowHours: 24,
  /** Hours within which an alert with the same reason + patient is considered a duplicate */
  sameReasonWindowHours: 24,
  /** Alert statuses that are considered "active" for duplicate detection */
  activeStatuses: ['new', 'acknowledged'] as const,
};

// ──────────────────────────────────────────────
// 4. TRANSPARENCY & RULE CUSTOMIZATION API
// ──────────────────────────────────────────────

/**
 * Updates a clinical rule's configuration dynamically (e.g. pain threshold, enabled status).
 * This enables clinicians to adjust configurations without rewriting code.
 */
export function updateClinicalRule(
  ruleId: string,
  updates: Partial<CheckinClinicalRule | SessionClinicalRule>
): boolean {
  const checkinRule = CHECKIN_CLINICAL_RULES.find((r) => r.id === ruleId);
  if (checkinRule) {
    Object.assign(checkinRule, updates);
    return true;
  }

  const sessionRule = SESSION_CLINICAL_RULES.find((r) => r.id === ruleId);
  if (sessionRule) {
    Object.assign(sessionRule, updates);
    return true;
  }

  return false;
}

/**
 * Updates an engagement rule's configuration dynamically.
 */
export function updateEngagementRule(
  ruleId: string,
  updates: Partial<EngagementRule>
): boolean {
  const rule = ENGAGEMENT_RULES.find((r) => r.id === ruleId);
  if (rule) {
    Object.assign(rule, updates);
    return true;
  }
  return false;
}

/**
 * Resets all rules to baseline demonstration defaults (used in test teardown & audits).
 */
export function resetRulesToDefault(): void {
  CHECKIN_CLINICAL_RULES = JSON.parse(JSON.stringify(INITIAL_CHECKIN_CLINICAL_RULES));
  SESSION_CLINICAL_RULES = JSON.parse(JSON.stringify(INITIAL_SESSION_CLINICAL_RULES));
  ENGAGEMENT_RULES = JSON.parse(JSON.stringify(INITIAL_ENGAGEMENT_RULES));
}

/**
 * Returns all clinical rules for transparency/audit display.
 */
export function getAllClinicalRules(): (CheckinClinicalRule | SessionClinicalRule)[] {
  return [...CHECKIN_CLINICAL_RULES, ...SESSION_CLINICAL_RULES];
}

/**
 * Returns all engagement rules for transparency/audit display.
 */
export function getAllEngagementRules(): EngagementRule[] {
  return [...ENGAGEMENT_RULES];
}

/**
 * Returns a summary of all active rules, suitable for clinician review.
 */
export function getRulesSummary(): {
  clinicalRules: { id: string; name: string; severity: string; enabled: boolean; description: string }[];
  engagementRules: { id: string; name: string; severity: string; enabled: boolean; description: string }[];
} {
  return {
    clinicalRules: getAllClinicalRules().map((r) => ({
      id: r.id,
      name: r.name,
      severity: r.severity,
      enabled: r.enabled,
      description: r.description,
    })),
    engagementRules: getAllEngagementRules().map((r) => ({
      id: r.id,
      name: r.name,
      severity: r.severity,
      enabled: r.enabled,
      description: r.description,
    })),
  };
}
