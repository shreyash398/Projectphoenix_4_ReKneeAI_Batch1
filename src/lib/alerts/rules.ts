// ReKnee AI - Deterministic Alert Rule Engine
// Strictly separating clinical review from engagement reminders

import { Alert, AlertCategory, AlertSeverity, SymptomCheckin, ExerciseSession } from '../../types/database';

export interface AlertRuleResult {
  shouldAlert: boolean;
  category?: AlertCategory;
  severity?: AlertSeverity;
  reason?: string;
}

/**
 * Evaluates a symptom checkin for clinical escalation rules.
 * All clinical thresholds are demonstrative and require clinician validation.
 */
export function evaluateCheckinAlert(checkin: SymptomCheckin): AlertRuleResult {
  const { pain_score, symptoms } = checkin;

  // Rule 1: Emergency Red Flag (Chest pain or difficulty breathing)
  if (symptoms.chest_pain_shortness_breath) {
    return {
      shouldAlert: true,
      category: 'clinical_review',
      severity: 'critical',
      reason:
        'CRITICAL RED-FLAG: Patient reported chest pain or shortness of breath. Immediate emergency care advised.',
    };
  }

  // Rule 2: Suspected DVT / Calf Tenderness with Elevated Pain or Swelling
  if (symptoms.calf_pain && (pain_score >= 5 || symptoms.swelling)) {
    return {
      shouldAlert: true,
      category: 'clinical_review',
      severity: 'urgent',
      reason: `Patient reported calf pain/tightness with pain score ${pain_score}/10 and swelling. Recommended review for DVT precaution.`,
    };
  }

  // Rule 3: High Acute Pain (Pain >= 8)
  if (pain_score >= 8) {
    return {
      shouldAlert: true,
      category: 'clinical_review',
      severity: 'urgent',
      reason: `Patient reported severe acute pain score (${pain_score}/10) exceeding post-op comfort threshold.`,
    };
  }

  // Rule 4: Infection Watch Signals (Fever + Redness / Warmth)
  if (symptoms.fever && (symptoms.redness || symptoms.warmth)) {
    return {
      shouldAlert: true,
      category: 'clinical_review',
      severity: 'urgent',
      reason:
        'Potential wound complication: Patient reported fever combined with localized redness or warmth.',
    };
  }

  return { shouldAlert: false };
}

/**
 * Evaluates activity gaps for engagement notifications.
 */
export function evaluateEngagementGap(
  lastActivityDate: Date | null,
  now: Date = new Date()
): AlertRuleResult {
  if (!lastActivityDate) {
    return {
      shouldAlert: true,
      category: 'engagement',
      severity: 'low',
      reason: 'Welcome: No exercise sessions or check-ins recorded yet.',
    };
  }

  const hoursSinceLast = (now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60);

  if (hoursSinceLast >= 48) {
    return {
      shouldAlert: true,
      category: 'engagement',
      severity: 'moderate',
      reason: `Adherence notice: No recovery activity recorded in the past ${Math.round(
        hoursSinceLast
      )} hours. Friendly check-in recommended.`,
    };
  }

  return { shouldAlert: false };
}

/**
 * Evaluates stopped-early exercise sessions.
 */
export function evaluateSessionAlert(session: ExerciseSession): AlertRuleResult {
  if (session.status === 'stopped_early' && session.repetitions < 3) {
    return {
      shouldAlert: true,
      category: 'clinical_review',
      severity: 'moderate',
      reason: `Exercise stopped early after only ${session.repetitions} repetitions. Patient may be experiencing acute discomfort.`,
    };
  }
  return { shouldAlert: false };
}

/**
 * Checks if an equivalent active alert already exists to prevent duplicate alert fatigue.
 */
export function isDuplicateAlert(existingAlerts: Alert[], newAlert: Partial<Alert>): boolean {
  return existingAlerts.some((existing) => {
    if (existing.status === 'closed') return false;
    if (existing.source_id && existing.source_id === newAlert.source_id) return true;
    if (existing.reason === newAlert.reason && existing.patient_id === newAlert.patient_id) {
      // If within 24 hours
      const diffHours =
        (Date.now() - new Date(existing.created_at).getTime()) / (1000 * 60 * 60);
      return diffHours < 24;
    }
    return false;
  });
}
