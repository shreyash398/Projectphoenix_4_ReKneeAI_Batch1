// In-memory & LocalStorage backed mock data store
// Provides full offline/demo capabilities matching 04_DATABASE.md

import {
  Profile,
  RecoveryPlan,
  PlanExercise,
  ExerciseSession,
  SymptomCheckin,
  KnowledgeArticle,
  AssistantQuestion,
  Alert,
  AlertAction,
  ClinicianPatientAccess,
} from '../../types/database';

export const DEMO_CLINICIAN_ID = 'c1111111-1111-1111-1111-111111111111';
export const DEMO_PATIENT_ID = 'p2222222-2222-2222-2222-222222222222';
export const DEMO_PLAN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const DEMO_EXERCISE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

interface StoreData {
  profiles: Profile[];
  plans: RecoveryPlan[];
  exercises: PlanExercise[];
  sessions: ExerciseSession[];
  checkins: SymptomCheckin[];
  articles: KnowledgeArticle[];
  assistantQuestions: AssistantQuestion[];
  access: ClinicianPatientAccess[];
  alerts: Alert[];
  alertActions: AlertAction[];
  activeUserId: string;
}

const DEFAULT_STORE: StoreData = {
  activeUserId: DEMO_PATIENT_ID,
  profiles: [
    {
      id: DEMO_PATIENT_ID,
      full_name: 'Eleanor Vance (Demo Patient - TKA Day 14)',
      role: 'patient',
      created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: DEMO_CLINICIAN_ID,
      full_name: 'Dr. Marcus Patel, DPT (Demo Clinician)',
      role: 'clinician',
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  plans: [
    {
      id: DEMO_PLAN_ID,
      patient_id: DEMO_PATIENT_ID,
      title: 'Post-TKA Early Stage Knee Mobility Protocol',
      status: 'active',
      start_date: new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0],
      end_date: new Date(Date.now() + 16 * 86400000).toISOString().split('T')[0],
      approved_by: DEMO_CLINICIAN_ID,
      created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
  ],
  exercises: [
    {
      id: DEMO_EXERCISE_ID,
      plan_id: DEMO_PLAN_ID,
      name: 'Seated Knee Flexion & Extension',
      instructions:
        'Sit upright in a sturdy chair with feet flat on the floor. Slowly slide your operative foot back under the chair as far as comfortable to bend your knee. Hold for 3 seconds, then gently straighten the leg forward. Repeat smoothly without bouncing.',
      target_repetitions: 10,
      target_duration_seconds: 180,
      sort_order: 1,
      created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
  ],
  sessions: [
    {
      id: 'sess-1',
      patient_id: DEMO_PATIENT_ID,
      plan_exercise_id: DEMO_EXERCISE_ID,
      started_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      ended_at: new Date(Date.now() - 2 * 86400000 + 180000).toISOString(),
      duration_seconds: 180,
      repetitions: 10,
      status: 'completed',
      measurement_mode: 'camera_prototype',
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 'sess-2',
      patient_id: DEMO_PATIENT_ID,
      plan_exercise_id: DEMO_EXERCISE_ID,
      started_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      ended_at: new Date(Date.now() - 1 * 86400000 + 140000).toISOString(),
      duration_seconds: 140,
      repetitions: 8,
      status: 'completed',
      measurement_mode: 'camera_prototype',
      created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
  ],
  checkins: [
    {
      id: 'chk-1',
      patient_id: DEMO_PATIENT_ID,
      pain_score: 4,
      symptoms: { swelling: true, stiffness: true },
      notes: 'Knee felt a bit stiff in the morning, loosened up after ice and gentle movement.',
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 'chk-2',
      patient_id: DEMO_PATIENT_ID,
      pain_score: 7,
      symptoms: { swelling: true, warmth: true, calf_pain: true },
      notes: 'Noticed increased tightness and aching in lower calf after afternoon walk.',
      created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
    },
  ],
  articles: [
    {
      id: '11111111-aaaa-bbbb-cccc-000000000001',
      title: 'Managing Normal Post-Op Swelling & Ice Protocol',
      content:
        'Mild to moderate swelling and warmth around the knee joint are normal responses in the first 2 to 6 weeks following knee replacement. Applying an ice pack wrapped in a light towel for 15-20 minutes, 3 to 4 times a day, helps manage tissue inflammation. Keep your leg elevated above heart level when resting.',
      source_label: 'Clinical Recovery Protocol v2.1 (Orthopedic Rehabilitation Unit)',
      source_url: null,
      version: '2.1',
      topic: 'swelling_and_ice',
      approval_status: 'approved',
      approved_by: DEMO_CLINICIAN_ID,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      id: '11111111-aaaa-bbbb-cccc-000000000002',
      title: 'Pain During Exercise: Stretching vs. Sharp Distress',
      content:
        'It is expected to feel muscular stretch, fatigue, or mild tightness (pain score up to 3-4 out of 10) during rehabilitation exercises. However, sudden sharp or tearing pain is a signal to stop immediately. Never force a joint through sharp mechanical pain. If pain escalates to 7 or above, rest the knee, apply ice, and log the incident.',
      source_label: 'Physical Therapy Practice Guidelines: Post-Arthroplasty',
      source_url: null,
      version: '1.4',
      topic: 'exercise_pain',
      approval_status: 'approved',
      approved_by: DEMO_CLINICIAN_ID,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      id: '11111111-aaaa-bbbb-cccc-000000000003',
      title: 'Incision Care and Infection Watch Signals',
      content:
        'Keep the surgical dressing dry and intact according to hospital discharge instructions. Inspect the incision daily for increasing perimeter redness extending beyond 1 inch, warmth that worsens over several days, cloudy or foul-smelling drainage, or an oral fever exceeding 100.4°F (38°C). Contact your care team promptly if any of these occur.',
      source_label: 'Post-Surgical Wound Management Standards',
      source_url: null,
      version: '3.0',
      topic: 'wound_care',
      approval_status: 'approved',
      approved_by: DEMO_CLINICIAN_ID,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      id: '11111111-aaaa-bbbb-cccc-000000000004',
      title: 'Red-Flag Alert: Deep Vein Thrombosis & Pulmonary Embolism',
      content:
        'Emergency warning signs require immediate medical attention. If you develop sudden shortness of breath, unexplained chest pain, severe calf tenderness, or pronounced swelling that extends into the calf and ankle, do not wait for a scheduled appointment. Call emergency services (911/local emergency) immediately.',
      source_label: 'Emergency Escalation Guidelines for Orthopedic Patients',
      source_url: null,
      version: '1.0',
      topic: 'emergency_dvt',
      approval_status: 'approved',
      approved_by: DEMO_CLINICIAN_ID,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
  ],
  assistantQuestions: [
    {
      id: 'q-1',
      patient_id: DEMO_PATIENT_ID,
      question: 'How often should I put ice on my knee?',
      answer:
        'According to the approved recovery guidance, you should apply an ice pack wrapped in a light towel for 15-20 minutes, 3 to 4 times a day. Be sure to keep your leg elevated above heart level when resting.',
      source_article_ids: ['11111111-aaaa-bbbb-cccc-000000000001'],
      status: 'answered',
      created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
  ],
  access: [
    {
      id: 'acc-1',
      clinician_id: DEMO_CLINICIAN_ID,
      patient_id: DEMO_PATIENT_ID,
      status: 'active',
      created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
  ],
  alerts: [
    {
      id: '44444444-4444-4444-4444-444444444444',
      patient_id: DEMO_PATIENT_ID,
      category: 'clinical_review',
      severity: 'urgent',
      source_type: 'symptom_checkin',
      source_id: 'chk-2',
      reason:
        'Symptom checkin reported elevated pain (7/10) with calf tightness/pain, requiring clinical review for DVT precaution.',
      status: 'new',
      created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
      reviewed_at: null,
      reviewed_by: null,
    },
  ],
  alertActions: [],
};

const STORAGE_KEY = 'reknee_ai_demo_store_v1';

export function getStore(): StoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // fallback to in-memory if storage fails
  }
  return DEFAULT_STORE;
}

export function saveStore(store: StoreData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // fallback
  }
}

export function resetDemoStore(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // fallback
  }
}
