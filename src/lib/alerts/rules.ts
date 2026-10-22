// ReKnee AI — Deterministic Alert Rule Engine
// =============================================
// Evaluates configured rules against patient events.
// All clinical thresholds come from alertConfig.ts — NO hardcoded medical thresholds here.
// NO LLM is used to determine whether an alert should be clinically escalated.
//
// TWO completely separate categories:
//   1. clinical_review — requires explicit configured rules to trigger
//   2. engagement — friendly adherence reminders, NEVER clinical danger

import { Alert, AlertCategory, AlertSeverity, SymptomCheckin, ExerciseSession } from '../../types/database';
import {
  CHECKIN_CLINICAL_RULES,
  SESSION_CLINICAL_RULES,
  ENGAGEMENT_RULES,
  DUPLICATE_PREVENTION,
  CheckinClinicalRule,
} from './alertConfig';

// ──────────────────────────────────────────────
// PUBLIC TYPES
// ──────────────────────────────────────────────

export interface AlertRuleResult {
  shouldAlert: boolean;
  category?: AlertCategory;
  severity?: AlertSeverity;
  reason?: string;
  /** Which configured rule ID triggered this result */
  ruleId?: string;
}

// ──────────────────────────────────────────────
// 1. CLINICAL ESCALATION — CHECKIN EVALUATION
// ──────────────────────────────────────────────

/**
 * Evaluates a symptom check-in against ALL enabled clinical escalation rules.
 * Rules are evaluated in priority order — first match wins.
 * Only explicitly configured rules can trigger clinical alerts.
 */
export function evaluateCheckinAlert(checkin: SymptomCheckin): AlertRuleResult {
  const { pain_score, symptoms } = checkin;

  for (const rule of CHECKIN_CLINICAL_RULES) {
    if (!rule.enabled) continue;

    if (matchesCheckinRule(rule, pain_score, symptoms)) {
      const reason = rule.reasonTemplate.replace('{pain_score}', String(pain_score));
      return {
        shouldAlert: true,
        category: rule.category,
        severity: rule.severity,
        reason,
        ruleId: rule.id,
      };
    }
  }

  return { shouldAlert: false };
}

/**
 * Checks whether a check-in matches a specific clinical rule.
 */
function matchesCheckinRule(
  rule: CheckinClinicalRule,
  painScore: number,
  symptoms: Record<string, boolean | undefined>
): boolean {
  // If rule has trigger symptoms, at least one must be present
  const hasTriggerSymptom =
    !rule.triggerSymptoms ||
    rule.triggerSymptoms.length === 0 ||
    rule.triggerSymptoms.some(key => symptoms[key] === true);

  if (!hasTriggerSymptom) return false;

  // If rule has a minimum pain score AND no co-symptoms, pain must meet threshold
  if (rule.minPainScore !== null && rule.minPainScore !== undefined) {
    // For rules with co-symptoms: trigger if pain >= threshold OR any co-symptom present
    if (rule.requiredCoSymptoms && rule.requiredCoSymptoms.length > 0) {
      const hasCoSymptom = rule.requiredCoSymptoms.some(key => symptoms[key] === true);
      if (painScore < rule.minPainScore && !hasCoSymptom) return false;
    } else {
      // Pure pain threshold rule
      if (painScore < rule.minPainScore) return false;
    }
  }

  // For rules with co-symptoms but NO trigger symptoms (not used currently, but safe)
  if (
    rule.requiredCoSymptoms &&
    rule.requiredCoSymptoms.length > 0 &&
    rule.triggerSymptoms &&
    rule.triggerSymptoms.length > 0
  ) {
    // Already handled above — trigger symptom + (pain OR co-symptom)
  }

  // Special case: fever + (redness OR warmth) rule
  // If rule has triggerSymptoms: ['fever'] and requiredCoSymptoms: ['redness', 'warmth']
  // Then fever must be present AND (redness OR warmth) must be present
  if (
    rule.triggerSymptoms &&
    rule.triggerSymptoms.length > 0 &&
    rule.requiredCoSymptoms &&
    rule.requiredCoSymptoms.length > 0 &&
    rule.minPainScore === null
  ) {
    const hasCoSymptom = rule.requiredCoSymptoms.some(key => symptoms[key] === true);
    if (!hasCoSymptom) return false;
  }

  return true;
}

// ──────────────────────────────────────────────
// 2. CLINICAL ESCALATION — SESSION EVALUATION
// ──────────────────────────────────────────────

/**
 * Evaluates an exercise session against ALL enabled session clinical rules.
 * A stopped exercise is NOT automatically a medical emergency.
 * Only matching configured rules trigger alerts.
 */
export function evaluateSessionAlert(session: ExerciseSession): AlertRuleResult {
  for (const rule of SESSION_CLINICAL_RULES) {
    if (!rule.enabled) continue;

    if (session.status === rule.triggerStatus && session.repetitions < rule.maxRepetitions) {
      const reason = rule.reasonTemplate.replace('{repetitions}', String(session.repetitions));
      return {
        shouldAlert: true,
        category: rule.category,
        severity: rule.severity,
        reason,
        ruleId: rule.id,
      };
    }
  }

  return { shouldAlert: false };
}

// ──────────────────────────────────────────────
// 3. ENGAGEMENT REMINDERS — COMPLETELY SEPARATE
// ──────────────────────────────────────────────

/**
 * Evaluates activity gap for engagement reminders.
 * These are NEVER clinical alerts — they use the 'engagement' category only.
 * A missed exercise session is NOT automatically a medical emergency.
 */
export function evaluateEngagementGap(
  lastActivityDate: Date | null,
  now: Date = new Date()
): AlertRuleResult {
  for (const rule of ENGAGEMENT_RULES) {
    if (!rule.enabled) continue;

    // Special rule: no activity ever recorded
    if (lastActivityDate === null && rule.inactivityHoursThreshold === 0) {
      return {
        shouldAlert: true,
        category: rule.category,
        severity: rule.severity,
        reason: rule.reasonTemplate,
        ruleId: rule.id,
      };
    }

    // Standard inactivity gap
    if (lastActivityDate && rule.inactivityHoursThreshold > 0) {
      const hoursSinceLast = (now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLast >= rule.inactivityHoursThreshold) {
        const reason = rule.reasonTemplate.replace('{hours}', String(Math.round(hoursSinceLast)));
        return {
          shouldAlert: true,
          category: rule.category,
          severity: rule.severity,
          reason,
          ruleId: rule.id,
        };
      }
    }
  }

  return { shouldAlert: false };
}

// ──────────────────────────────────────────────
// 4. DUPLICATE ALERT PREVENTION
// ──────────────────────────────────────────────

/**
 * Checks if an equivalent active alert already exists to prevent clinician alert fatigue.
 * Uses configurable time windows from DUPLICATE_PREVENTION.
 */
export function isDuplicateAlert(existingAlerts: Alert[], newAlert: Partial<Alert>): boolean {
  const { sameSourceWindowHours, sameReasonWindowHours, activeStatuses } = DUPLICATE_PREVENTION;

  return existingAlerts.some((existing) => {
    // Only check against active (non-closed) alerts
    if (!activeStatuses.includes(existing.status as typeof activeStatuses[number])) return false;

    // Same source_id → duplicate regardless of reason
    if (existing.source_id && existing.source_id === newAlert.source_id) {
      const diffHours =
        (Date.now() - new Date(existing.created_at).getTime()) / (1000 * 60 * 60);
      return diffHours < sameSourceWindowHours;
    }

    // Same reason + same patient within time window
    if (existing.reason === newAlert.reason && existing.patient_id === newAlert.patient_id) {
      const diffHours =
        (Date.now() - new Date(existing.created_at).getTime()) / (1000 * 60 * 60);
      return diffHours < sameReasonWindowHours;
    }

    return false;
  });
}
