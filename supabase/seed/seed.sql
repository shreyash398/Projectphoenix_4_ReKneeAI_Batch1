-- ReKnee AI: Synthetic Demonstration Seed Data
-- Strictly synthetic demo entities for testing & validation

-- Demo IDs
-- Clinician ID: c1111111-1111-1111-1111-111111111111
-- Patient ID:   p2222222-2222-2222-2222-222222222222
-- Plan ID:      aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- Exercise ID:  bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
-- Article 1:    11111111-aaaa-bbbb-cccc-000000000001
-- Article 2:    11111111-aaaa-bbbb-cccc-000000000002
-- Article 3:    11111111-aaaa-bbbb-cccc-000000000003
-- Article 4:    11111111-aaaa-bbbb-cccc-000000000004

-- 1. PROFILES
insert into profiles (id, full_name, role)
values
  ('c1111111-1111-1111-1111-111111111111', 'Dr. Marcus Patel, DPT (Demo Clinician)', 'clinician'),
  ('p2222222-2222-2222-2222-222222222222', 'Eleanor Vance (Demo Patient - TKA Day 14)', 'patient')
on conflict (id) do nothing;

-- 2. CLINICIAN PATIENT ACCESS
insert into clinician_patient_access (clinician_id, patient_id, status)
values
  ('c1111111-1111-1111-1111-111111111111', 'p2222222-2222-2222-2222-222222222222', 'active')
on conflict (clinician_id, patient_id) do nothing;

-- 3. RECOVERY PLAN
insert into recovery_plans (id, patient_id, title, status, start_date, approved_by)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'p2222222-2222-2222-2222-222222222222', 'Post-TKA Early Stage Knee Mobility Protocol', 'active', current_date - interval '14 days', 'c1111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

-- 4. PLAN EXERCISE (The 1 Supported MVP Exercise)
insert into plan_exercises (id, plan_id, name, instructions, target_repetitions, target_duration_seconds, sort_order)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Seated Knee Flexion & Extension', 'Sit upright in a sturdy chair with feet flat on the floor. Slowly slide your operative foot back under the chair as far as comfortable to bend your knee. Hold for 3 seconds, then gently straighten the leg forward. Repeat smoothly without bouncing.', 10, 180, 1)
on conflict (id) do nothing;

-- 5. APPROVED KNOWLEDGE ARTICLES
insert into knowledge_articles (id, title, content, source_label, source_url, version, topic, approval_status, approved_by)
values
  ('11111111-aaaa-bbbb-cccc-000000000001', 'Managing Normal Post-Op Swelling & Ice Protocol', 'Mild to moderate swelling and warmth around the knee joint are normal responses in the first 2 to 6 weeks following knee replacement. Applying an ice pack wrapped in a light towel for 15-20 minutes, 3 to 4 times a day, helps manage tissue inflammation. Keep your leg elevated above heart level when resting.', 'Clinical Recovery Protocol v2.1 (Orthopedic Rehabilitation Unit)', null, '2.1', 'swelling_and_ice', 'approved', 'c1111111-1111-1111-1111-111111111111'),

  ('11111111-aaaa-bbbb-cccc-000000000002', 'Pain During Exercise: Stretching vs. Sharp Distress', 'It is expected to feel muscular stretch, fatigue, or mild tightness (pain score up to 3-4 out of 10) during rehabilitation exercises. However, sudden sharp or tearing pain is a signal to stop. Never force a joint through sharp mechanical pain. If pain escalates to 7 or above, rest the knee, apply ice, and log the incident.', 'Physical Therapy Practice Guidelines: Post-Arthroplasty', null, '1.4', 'exercise_pain', 'approved', 'c1111111-1111-1111-1111-111111111111'),

  ('11111111-aaaa-bbbb-cccc-000000000003', 'Incision Care and Infection Watch Signals', 'Keep the surgical dressing dry and intact according to hospital discharge instructions. Inspect the incision daily for increasing perimeter redness extending beyond 1 inch, warmth that worsens over several days, cloudy or foul-smelling drainage, or an oral fever exceeding 100.4°F (38°C). Contact your care team promptly if any of these occur.', 'Post-Surgical Wound Management Standards', null, '3.0', 'wound_care', 'approved', 'c1111111-1111-1111-1111-111111111111'),

  ('11111111-aaaa-bbbb-cccc-000000000004', 'Red-Flag Alert: Deep Vein Thrombosis & Pulmonary Embolism', 'Emergency warning signs require immediate medical attention. If you develop sudden shortness of breath, unexplained chest pain, severe calf tenderness, or pronounced swelling that extends into the calf and ankle, do not wait for a scheduled appointment. Call emergency services (911/local emergency) immediately.', 'Emergency Escalation Guidelines for Orthopedic Patients', null, '1.0', 'emergency_dvt', 'approved', 'c1111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

-- 6. HISTORICAL SESSIONS
insert into exercise_sessions (patient_id, plan_exercise_id, started_at, ended_at, duration_seconds, repetitions, status, measurement_mode)
values
  ('p2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now() - interval '2 days', now() - interval '2 days' + interval '3 minutes', 180, 10, 'completed', 'camera_prototype'),
  ('p2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now() - interval '1 day', now() - interval '1 day' + interval '2 minutes', 140, 8, 'completed', 'camera_prototype');

-- 7. HISTORICAL CHECKINS
insert into symptom_checkins (id, patient_id, pain_score, symptoms, notes, created_at)
values
  ('33333333-3333-3333-3333-333333333331', 'p2222222-2222-2222-2222-222222222222', 4, '{"swelling": true, "stiffness": true}'::jsonb, 'Knee felt a bit stiff in the morning, loosened up after ice and gentle movement.', now() - interval '2 days'),
  ('33333333-3333-3333-3333-333333333332', 'p2222222-2222-2222-2222-222222222222', 7, '{"swelling": true, "warmth": true, "calf_pain": true}'::jsonb, 'Noticed increased tightness and aching in lower calf after afternoon walk.', now() - interval '4 hours');

-- 8. DEMO ALERT (Generated by rule engine from the recent elevated checkin)
insert into alerts (id, patient_id, category, severity, source_type, source_id, reason, status, created_at)
values
  ('44444444-4444-4444-4444-444444444444', 'p2222222-2222-2222-2222-222222222222', 'clinical_review', 'urgent', 'symptom_checkin', '33333333-3333-3333-3333-333333333332', 'Symptom checkin reported elevated pain (7/10) with calf tightness/pain, requiring clinical review for DVT precaution.', 'new', now() - interval '4 hours')
on conflict (id) do nothing;
