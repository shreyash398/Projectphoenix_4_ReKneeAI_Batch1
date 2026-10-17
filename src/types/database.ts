// ReKnee AI - Database Domain Types
// Strictly adhering to 04_DATABASE.md and 05_API.md

export type UserRole = 'patient' | 'clinician';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export type PlanStatus = 'active' | 'completed' | 'paused' | 'draft';

export interface RecoveryPlan {
  id: string;
  patient_id: string;
  title: string;
  status: PlanStatus;
  start_date: string;
  end_date: string;
  approved_by: string; // clinician profile id
  created_at: string;
}

export interface PlanExercise {
  id: string;
  plan_id: string;
  name: string;
  instructions: string;
  target_repetitions: number;
  target_duration_seconds: number;
  sort_order: number;
  created_at: string;
}

export type SessionStatus = 'completed' | 'stopped_early' | 'skipped';
export type MeasurementMode = 'camera_prototype' | 'manual_demo';

export interface ExerciseSession {
  id: string;
  patient_id: string;
  plan_exercise_id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  repetitions: number;
  status: SessionStatus;
  measurement_mode: MeasurementMode;
  created_at: string;
}

export interface SymptomCheckin {
  id: string;
  patient_id: string;
  pain_score: number; // 0..10
  symptoms: {
    swelling?: boolean;
    warmth?: boolean;
    redness?: boolean;
    stiffness?: boolean;
    numbness?: boolean;
    calf_pain?: boolean;
    fever?: boolean;
    chest_pain_shortness_breath?: boolean;
    [key: string]: boolean | undefined;
  };
  notes: string;
  created_at: string;
}

export type ApprovalStatus = 'draft' | 'approved' | 'retired';

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  source_label: string;
  source_url?: string | null;
  version: string;
  topic: string;
  approval_status: ApprovalStatus;
  approved_by?: string | null;
  created_at: string;
  updated_at: string;
}

export type AssistantQuestionStatus = 'answered' | 'unsupported_safe_fallback' | 'emergency_escalation' | 'error';

export interface AssistantQuestion {
  id: string;
  patient_id: string;
  question: string;
  answer?: string | null;
  source_article_ids?: string[] | null;
  status: AssistantQuestionStatus;
  created_at: string;
}

export interface ClinicianPatientAccess {
  id: string;
  clinician_id: string;
  patient_id: string;
  status: 'active' | 'revoked';
  created_at: string;
}

export type AlertCategory = 'clinical_review' | 'engagement';
export type AlertSeverity = 'critical' | 'urgent' | 'moderate' | 'low';
export type AlertStatus = 'new' | 'reviewed' | 'acknowledged' | 'closed';

export interface Alert {
  id: string;
  patient_id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  source_type: 'symptom_checkin' | 'exercise_session' | 'adherence_gap';
  source_id: string;
  reason: string;
  status: AlertStatus;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

export interface AlertAction {
  id: string;
  alert_id: string;
  clinician_id: string;
  action: string;
  notes: string;
  created_at: string;
}
