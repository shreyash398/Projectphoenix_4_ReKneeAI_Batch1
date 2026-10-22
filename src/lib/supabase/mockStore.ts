// In-memory & LocalStorage backed mock data store
// Provides full offline/demo capabilities matching 04_DATABASE.md
// All data is synthetic — no real patient information

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

// ── Deterministic date helpers (relative to "now") ──────────────
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}
function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3600000).toISOString();
}
function dateOnly(iso: string): string {
  return iso.split('T')[0];
}

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

// ── Profiles ────────────────────────────────────────────────────
const DEMO_PROFILES: Profile[] = [
  {
    id: DEMO_PATIENT_ID,
    full_name: 'Eleanor Vance (Demo Patient - TKA Day 14)',
    role: 'patient',
    created_at: daysAgo(14),
    updated_at: new Date().toISOString(),
  },
  {
    id: DEMO_CLINICIAN_ID,
    full_name: 'Dr. Marcus Patel, DPT (Demo Clinician)',
    role: 'clinician',
    created_at: daysAgo(30),
    updated_at: new Date().toISOString(),
  },
];

// ── Recovery Plan ───────────────────────────────────────────────
const DEMO_PLANS: RecoveryPlan[] = [
  {
    id: DEMO_PLAN_ID,
    patient_id: DEMO_PATIENT_ID,
    title: 'Post-TKA Early Stage Knee Mobility Protocol',
    status: 'active',
    start_date: dateOnly(daysAgo(14)),
    end_date: dateOnly(new Date(Date.now() + 16 * 86400000).toISOString()),
    approved_by: DEMO_CLINICIAN_ID,
    created_at: daysAgo(14),
  },
];

// ── Exercise ────────────────────────────────────────────────────
const DEMO_EXERCISES: PlanExercise[] = [
  {
    id: DEMO_EXERCISE_ID,
    plan_id: DEMO_PLAN_ID,
    name: 'Seated Knee Flexion & Extension',
    instructions:
      'Sit upright in a sturdy chair with feet flat on the floor. Slowly slide your operative foot back under the chair as far as comfortable to bend your knee. Hold for 3 seconds, then gently straighten the leg forward. Repeat smoothly without bouncing.',
    target_repetitions: 10,
    target_duration_seconds: 180,
    sort_order: 1,
    created_at: daysAgo(14),
  },
];

// ── Exercise Sessions (realistic multi-day history + today) ────
const DEMO_SESSIONS: ExerciseSession[] = [
  // Day 3 post-op — first attempt, stopped early
  {
    id: 'sess-day3',
    patient_id: DEMO_PATIENT_ID,
    plan_exercise_id: DEMO_EXERCISE_ID,
    started_at: daysAgo(11),
    ended_at: new Date(Date.now() - 11 * 86400000 + 90000).toISOString(),
    duration_seconds: 90,
    repetitions: 4,
    status: 'completed',
    measurement_mode: 'manual_demo',
    created_at: daysAgo(11),
  },
  // Day 5 — improving
  {
    id: 'sess-day5',
    patient_id: DEMO_PATIENT_ID,
    plan_exercise_id: DEMO_EXERCISE_ID,
    started_at: daysAgo(9),
    ended_at: new Date(Date.now() - 9 * 86400000 + 120000).toISOString(),
    duration_seconds: 120,
    repetitions: 6,
    status: 'completed',
    measurement_mode: 'manual_demo',
    created_at: daysAgo(9),
  },
  // Day 7 — good session
  {
    id: 'sess-day7',
    patient_id: DEMO_PATIENT_ID,
    plan_exercise_id: DEMO_EXERCISE_ID,
    started_at: daysAgo(7),
    ended_at: new Date(Date.now() - 7 * 86400000 + 150000).toISOString(),
    duration_seconds: 150,
    repetitions: 8,
    status: 'completed',
    measurement_mode: 'camera_prototype',
    created_at: daysAgo(7),
  },
  // Day 10 — full target reached
  {
    id: 'sess-day10',
    patient_id: DEMO_PATIENT_ID,
    plan_exercise_id: DEMO_EXERCISE_ID,
    started_at: daysAgo(4),
    ended_at: new Date(Date.now() - 4 * 86400000 + 180000).toISOString(),
    duration_seconds: 180,
    repetitions: 10,
    status: 'completed',
    measurement_mode: 'camera_prototype',
    created_at: daysAgo(4),
  },
  // Day 12 — strong session
  {
    id: 'sess-day12',
    patient_id: DEMO_PATIENT_ID,
    plan_exercise_id: DEMO_EXERCISE_ID,
    started_at: daysAgo(2),
    ended_at: new Date(Date.now() - 2 * 86400000 + 180000).toISOString(),
    duration_seconds: 180,
    repetitions: 10,
    status: 'completed',
    measurement_mode: 'camera_prototype',
    created_at: daysAgo(2),
  },
  // Yesterday — completed
  {
    id: 'sess-yesterday',
    patient_id: DEMO_PATIENT_ID,
    plan_exercise_id: DEMO_EXERCISE_ID,
    started_at: daysAgo(1),
    ended_at: new Date(Date.now() - 1 * 86400000 + 140000).toISOString(),
    duration_seconds: 140,
    repetitions: 8,
    status: 'completed',
    measurement_mode: 'camera_prototype',
    created_at: daysAgo(1),
  },
];

// ── Symptom Check-ins (progressive recovery + alert trigger) ───
const DEMO_CHECKINS: SymptomCheckin[] = [
  // Day 3 — early recovery
  {
    id: 'chk-day3',
    patient_id: DEMO_PATIENT_ID,
    pain_score: 6,
    symptoms: { swelling: true, stiffness: true },
    notes: 'Noticeable swelling around the knee. Mobility is limited but expected at this stage.',
    created_at: daysAgo(11),
  },
  // Day 5 — improving
  {
    id: 'chk-day5',
    patient_id: DEMO_PATIENT_ID,
    pain_score: 5,
    symptoms: { swelling: true, stiffness: true },
    notes: 'Swelling receding slightly. Ice protocol helping. Doing gentle movements.',
    created_at: daysAgo(9),
  },
  // Day 7 — stable
  {
    id: 'chk-day7',
    patient_id: DEMO_PATIENT_ID,
    pain_score: 4,
    symptoms: { stiffness: true },
    notes: 'Morning stiffness fading faster. Pain manageable during exercise.',
    created_at: daysAgo(7),
  },
  // Day 10 — positive trend
  {
    id: 'chk-day10',
    patient_id: DEMO_PATIENT_ID,
    pain_score: 3,
    symptoms: { stiffness: true },
    notes: 'Good progress. Completed full exercise set today with only mild discomfort.',
    created_at: daysAgo(4),
  },
  // Day 12 — mild day
  {
    id: 'chk-day12',
    patient_id: DEMO_PATIENT_ID,
    pain_score: 4,
    symptoms: { swelling: true, stiffness: true },
    notes: 'Knee felt a bit stiff in the morning, loosened up after ice and gentle movement.',
    created_at: daysAgo(2),
  },
  // Today (4 hours ago) — ALERT TRIGGER: elevated pain + calf_pain + swelling
  // This triggers rule CR-002 (DVT Precaution) for the demo alert workflow
  {
    id: 'chk-today-alert',
    patient_id: DEMO_PATIENT_ID,
    pain_score: 7,
    symptoms: { swelling: true, warmth: true, calf_pain: true },
    notes: 'Noticed increased tightness and aching in lower calf after afternoon walk.',
    created_at: hoursAgo(4),
  },
];

// ── Knowledge Articles (approved recovery content) ──────────────
const DEMO_ARTICLES: KnowledgeArticle[] = [
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
    created_at: daysAgo(30),
    updated_at: daysAgo(30),
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
    created_at: daysAgo(30),
    updated_at: daysAgo(30),
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
    created_at: daysAgo(30),
    updated_at: daysAgo(30),
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
    created_at: daysAgo(30),
    updated_at: daysAgo(30),
  },
  {
    id: '11111111-aaaa-bbbb-cccc-000000000005',
    title: 'Safe Mobility Milestones in Early Recovery',
    content:
      'During the first 2 weeks, use prescribed walking aids (crutches or walker) whenever moving. Short walks of 5 to 10 minutes every 2 hours during waking time help maintain circulation and prevent stiffness. Avoid pivoting on the operated leg. Sit down to put on shoes and socks. Use a raised toilet seat if recommended by your therapist. Gradual progress is expected — most patients notice meaningful improvement in mobility between weeks 3 and 6.',
    source_label: 'Early Mobilization Protocol for Total Knee Arthroplasty',
    source_url: null,
    version: '1.2',
    topic: 'mobility_milestones',
    approval_status: 'approved',
    approved_by: DEMO_CLINICIAN_ID,
    created_at: daysAgo(30),
    updated_at: daysAgo(30),
  },
];

// ── Pre-seeded Assistant Conversation History ───────────────────
const DEMO_ASSISTANT_QUESTIONS: AssistantQuestion[] = [
  {
    id: 'q-seed-1',
    patient_id: DEMO_PATIENT_ID,
    question: 'How often should I put ice on my knee?',
    answer:
      'According to the approved recovery guidance, you should apply an ice pack wrapped in a light towel for 15-20 minutes, 3 to 4 times a day. Be sure to keep your leg elevated above heart level when resting.',
    source_article_ids: ['11111111-aaaa-bbbb-cccc-000000000001'],
    status: 'answered',
    created_at: daysAgo(5),
  },
  {
    id: 'q-seed-2',
    patient_id: DEMO_PATIENT_ID,
    question: 'Is mild pain during exercises normal?',
    answer:
      'Based on your approved recovery guidance ("Pain During Exercise: Stretching vs. Sharp Distress"): It is expected to feel muscular stretch, fatigue, or mild tightness (pain score up to 3-4 out of 10) during rehabilitation exercises. However, sudden sharp or tearing pain is a signal to stop immediately.',
    source_article_ids: ['11111111-aaaa-bbbb-cccc-000000000002'],
    status: 'answered',
    created_at: daysAgo(3),
  },
];

// ── Clinician Access ────────────────────────────────────────────
const DEMO_ACCESS: ClinicianPatientAccess[] = [
  {
    id: 'acc-1',
    clinician_id: DEMO_CLINICIAN_ID,
    patient_id: DEMO_PATIENT_ID,
    status: 'active',
    created_at: daysAgo(14),
  },
];

// ── Alerts (pre-seeded with the DVT precaution alert) ───────────
const DEMO_ALERTS: Alert[] = [
  {
    id: '44444444-4444-4444-4444-444444444444',
    patient_id: DEMO_PATIENT_ID,
    category: 'clinical_review',
    severity: 'urgent',
    source_type: 'symptom_checkin',
    source_id: 'chk-today-alert',
    reason:
      'Patient reported calf pain/tightness with pain score 7/10. Recommended review for DVT precaution. [Rule: CR-002]',
    status: 'new',
    created_at: hoursAgo(4),
    reviewed_at: null,
    reviewed_by: null,
  },
];

// ── Default Store Assembly ──────────────────────────────────────
const DEFAULT_STORE: StoreData = {
  activeUserId: DEMO_PATIENT_ID,
  profiles: DEMO_PROFILES,
  plans: DEMO_PLANS,
  exercises: DEMO_EXERCISES,
  sessions: DEMO_SESSIONS,
  checkins: DEMO_CHECKINS,
  articles: DEMO_ARTICLES,
  assistantQuestions: DEMO_ASSISTANT_QUESTIONS,
  access: DEMO_ACCESS,
  alerts: DEMO_ALERTS,
  alertActions: [],
};

let inMemoryStore: StoreData = JSON.parse(JSON.stringify(DEFAULT_STORE));

const STORAGE_KEY = 'reknee_ai_demo_store_v1';

export function getStore(): StoreData {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    }
  } catch {
    // fallback to in-memory if storage fails
  }
  return inMemoryStore;
}

export function saveStore(store: StoreData): void {
  inMemoryStore = store;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    }
  } catch {
    // fallback
  }
}

export function resetDemoStore(): void {
  inMemoryStore = JSON.parse(JSON.stringify(DEFAULT_STORE));
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // fallback
  }
}
