-- ReKnee AI: Synthetic Demonstration Seed Data
-- Strictly synthetic demonstration entities for testing & validation
-- Compliant with:
--   04_DATABASE.md
--   10_DATABASE_BACKEND.md
--   16_SECURITY_AUDIT.md

-- Standard Demo Entity UUIDs:
-- Clinician ID: c1111111-1111-1111-1111-111111111111
-- Patient ID:   p2222222-2222-2222-2222-222222222222
-- Plan ID:      aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- Exercise ID:  bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
-- Article 1:    11111111-aaaa-bbbb-cccc-000000000001
-- Article 2:    11111111-aaaa-bbbb-cccc-000000000002
-- Article 3:    11111111-aaaa-bbbb-cccc-000000000003
-- Article 4:    11111111-aaaa-bbbb-cccc-000000000004
-- Checkin 1:    33333333-3333-3333-3333-333333333331
-- Checkin 2:    33333333-3333-3333-3333-333333333332
-- Alert 1:      44444444-4444-4444-4444-444444444444

-- ============================================================================
-- 1. AUTH USERS (Inserted conditionally if running against live Supabase auth)
-- ============================================================================
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    insert into auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      role,
      aud,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values
      (
        'c1111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'clinician@demo.reknee.ai',
        crypt('DemoClinicianPass2026!', gen_salt('bf')),
        now(),
        'authenticated',
        'authenticated',
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Dr. Marcus Patel, DPT (Demo Clinician)","role":"clinician"}'::jsonb,
        now() - interval '30 days',
        now()
      ),
      (
        'p2222222-2222-2222-2222-222222222222',
        '00000000-0000-0000-0000-000000000000',
        'patient@demo.reknee.ai',
        crypt('DemoPatientPass2026!', gen_salt('bf')),
        now(),
        'authenticated',
        'authenticated',
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Eleanor Vance (Demo Patient - TKA Day 14)","role":"patient"}'::jsonb,
        now() - interval '14 days',
        now()
      )
    on conflict (id) do nothing;
  end if;
end $$;

-- ============================================================================
-- 2. PROFILES
-- ============================================================================
insert into profiles (id, full_name, role, created_at, updated_at)
values
  (
    'c1111111-1111-1111-1111-111111111111',
    'Dr. Marcus Patel, DPT (Demo Clinician)',
    'clinician',
    now() - interval '30 days',
    now()
  ),
  (
    'p2222222-2222-2222-2222-222222222222',
    'Eleanor Vance (Demo Patient - TKA Day 14)',
    'patient',
    now() - interval '14 days',
    now()
  )
on conflict (id) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  updated_at = now();

-- ============================================================================
-- 3. CLINICIAN PATIENT ACCESS
-- ============================================================================
insert into clinician_patient_access (clinician_id, patient_id, status, created_at)
values
  (
    'c1111111-1111-1111-1111-111111111111',
    'p2222222-2222-2222-2222-222222222222',
    'active',
    now() - interval '14 days'
  )
on conflict (clinician_id, patient_id) do update set
  status = 'active';

-- ============================================================================
-- 4. RECOVERY PLAN
-- ============================================================================
insert into recovery_plans (id, patient_id, title, status, start_date, end_date, approved_by, created_at)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'p2222222-2222-2222-2222-222222222222',
    'Post-TKA Early Stage Knee Mobility Protocol',
    'active',
    (current_date - interval '14 days')::date,
    (current_date + interval '16 days')::date,
    'c1111111-1111-1111-1111-111111111111',
    now() - interval '14 days'
  )
on conflict (id) do update set
  title = excluded.title,
  status = excluded.status,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  approved_by = excluded.approved_by;

-- ============================================================================
-- 5. PLAN EXERCISES (The 1 Supported MVP Exercise)
-- ============================================================================
insert into plan_exercises (id, plan_id, name, instructions, target_repetitions, target_duration_seconds, sort_order, created_at)
values
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Seated Knee Flexion & Extension',
    'Sit upright in a sturdy chair with feet flat on the floor. Slowly slide your operative foot back under the chair as far as comfortable to bend your knee. Hold for 3 seconds, then gently straighten the leg forward. Repeat smoothly without bouncing.',
    10,
    180,
    1,
    now() - interval '14 days'
  )
on conflict (id) do update set
  name = excluded.name,
  instructions = excluded.instructions,
  target_repetitions = excluded.target_repetitions,
  target_duration_seconds = excluded.target_duration_seconds,
  sort_order = excluded.sort_order;

-- ============================================================================
-- 6. APPROVED KNOWLEDGE ARTICLES (Documented Clinical Recovery Content)
-- ============================================================================
insert into knowledge_articles (id, title, content, source_label, source_url, version, topic, approval_status, approved_by, created_at, updated_at)
values
  (
    '11111111-aaaa-bbbb-cccc-000000000001',
    'Managing Normal Post-Op Swelling & Ice Protocol',
    'Mild to moderate swelling and warmth around the knee joint are normal responses in the first 2 to 6 weeks following knee replacement. Applying an ice pack wrapped in a light towel for 15-20 minutes, 3 to 4 times a day, helps manage tissue inflammation. Keep your leg elevated above heart level when resting.',
    'Clinical Recovery Protocol v2.1 (Orthopedic Rehabilitation Unit)',
    null,
    '2.1',
    'swelling_and_ice',
    'approved',
    'c1111111-1111-1111-1111-111111111111',
    now() - interval '30 days',
    now() - interval '30 days'
  ),
  (
    '11111111-aaaa-bbbb-cccc-000000000002',
    'Pain During Exercise: Stretching vs. Sharp Distress',
    'It is expected to feel muscular stretch, fatigue, or mild tightness (pain score up to 3-4 out of 10) during rehabilitation exercises. However, sudden sharp or tearing pain is a signal to stop. Never force a joint through sharp mechanical pain. If pain escalates to 7 or above, rest the knee, apply ice, and log the incident.',
    'Physical Therapy Practice Guidelines: Post-Arthroplasty',
    null,
    '1.4',
    'exercise_pain',
    'approved',
    'c1111111-1111-1111-1111-111111111111',
    now() - interval '30 days',
    now() - interval '30 days'
  ),
  (
    '11111111-aaaa-bbbb-cccc-000000000003',
    'Incision Care and Infection Watch Signals',
    'Keep the surgical dressing dry and intact according to hospital discharge instructions. Inspect the incision daily for increasing perimeter redness extending beyond 1 inch, warmth that worsens over several days, cloudy or foul-smelling drainage, or an oral fever exceeding 100.4°F (38°C). Contact your care team promptly if any of these occur.',
    'Post-Surgical Wound Management Standards',
    null,
    '3.0',
    'wound_care',
    'approved',
    'c1111111-1111-1111-1111-111111111111',
    now() - interval '30 days',
    now() - interval '30 days'
  ),
  (
    '11111111-aaaa-bbbb-cccc-000000000004',
    'Red-Flag Alert: Deep Vein Thrombosis & Pulmonary Embolism',
    'Emergency warning signs require immediate medical attention. If you develop sudden shortness of breath, unexplained chest pain, severe calf tenderness, or pronounced swelling that extends into the calf and ankle, do not wait for a scheduled appointment. Call emergency services (911/local emergency) immediately.',
    'Emergency Escalation Guidelines for Orthopedic Patients',
    null,
    '1.0',
    'emergency_dvt',
    'approved',
    'c1111111-1111-1111-1111-111111111111',
    now() - interval '30 days',
    now() - interval '30 days'
  )
on conflict (id) do update set
  title = excluded.title,
  content = excluded.content,
  source_label = excluded.source_label,
  version = excluded.version,
  approval_status = excluded.approval_status,
  approved_by = excluded.approved_by,
  updated_at = now();

-- ============================================================================
-- 7. HISTORICAL EXERCISE SESSIONS
-- ============================================================================
insert into exercise_sessions (id, patient_id, plan_exercise_id, started_at, ended_at, duration_seconds, repetitions, status, measurement_mode, created_at)
values
  (
    '55555555-5555-5555-5555-555555555551',
    'p2222222-2222-2222-2222-222222222222',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    now() - interval '2 days',
    now() - interval '2 days' + interval '3 minutes',
    180,
    10,
    'completed',
    'camera_prototype',
    now() - interval '2 days'
  ),
  (
    '55555555-5555-5555-5555-555555555552',
    'p2222222-2222-2222-2222-222222222222',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    now() - interval '1 day',
    now() - interval '1 day' + interval '2 minutes 20 seconds',
    140,
    8,
    'completed',
    'camera_prototype',
    now() - interval '1 day'
  )
on conflict (id) do nothing;

-- ============================================================================
-- 8. HISTORICAL SYMPTOM CHECKINS
-- ============================================================================
insert into symptom_checkins (id, patient_id, pain_score, symptoms, notes, created_at)
values
  (
    '33333333-3333-3333-3333-333333333331',
    'p2222222-2222-2222-2222-222222222222',
    4,
    '{"swelling": true, "stiffness": true}'::jsonb,
    'Knee felt a bit stiff in the morning, loosened up after ice and gentle movement.',
    now() - interval '2 days'
  ),
  (
    '33333333-3333-3333-3333-333333333332',
    'p2222222-2222-2222-2222-222222222222',
    7,
    '{"swelling": true, "warmth": true, "calf_pain": true}'::jsonb,
    'Noticed increased tightness and aching in lower calf after afternoon walk.',
    now() - interval '4 hours'
  )
on conflict (id) do nothing;

-- ============================================================================
-- 9. ACTIVE DEMO ALERT (Generated from Checkin 2 Rule Evaluation)
-- ============================================================================
insert into alerts (id, patient_id, category, severity, source_type, source_id, reason, status, created_at, reviewed_at, reviewed_by)
values
  (
    '44444444-4444-4444-4444-444444444444',
    'p2222222-2222-2222-2222-222222222222',
    'clinical_review',
    'urgent',
    'symptom_checkin',
    '33333333-3333-3333-3333-333333333332',
    'Symptom checkin reported elevated pain (7/10) with calf tightness/pain, requiring clinical review for DVT precaution.',
    'new',
    now() - interval '4 hours',
    null,
    null
  )
on conflict (id) do nothing;

-- ============================================================================
-- 10. ASSISTANT QUESTIONS (Sample Grounded Q&A Record)
-- ============================================================================
insert into assistant_questions (id, patient_id, question, answer, source_article_ids, status, created_at)
values
  (
    '66666666-6666-6666-6666-666666666661',
    'p2222222-2222-2222-2222-222222222222',
    'How often should I put ice on my knee?',
    'Based on your approved recovery guidance ("Managing Normal Post-Op Swelling & Ice Protocol"): Mild to moderate swelling and warmth around the knee joint are normal responses in the first 2 to 6 weeks following knee replacement. Applying an ice pack wrapped in a light towel for 15-20 minutes, 3 to 4 times a day, helps manage tissue inflammation. Keep your leg elevated above heart level when resting.',
    array['11111111-aaaa-bbbb-cccc-000000000001'::uuid],
    'answered',
    now() - interval '1 day'
  )
on conflict (id) do nothing;
