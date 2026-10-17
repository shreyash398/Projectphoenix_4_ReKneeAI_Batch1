-- ReKnee AI: Initial Database Schema Migration
-- Matches 04_DATABASE.md and 10_DATABASE_BACKEND.md

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('patient', 'clinician')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. RECOVERY PLANS
create table if not exists recovery_plans (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'paused', 'draft')),
  start_date date not null default current_date,
  end_date date,
  approved_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- 3. PLAN EXERCISES
create table if not exists plan_exercises (
  id uuid primary key default uuid_generate_v4(),
  plan_id uuid not null references recovery_plans(id) on delete cascade,
  name text not null,
  instructions text not null,
  target_repetitions integer not null check (target_repetitions >= 0),
  target_duration_seconds integer not null check (target_duration_seconds >= 0),
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

-- 4. EXERCISE SESSIONS
create table if not exists exercise_sessions (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references profiles(id) on delete cascade,
  plan_exercise_id uuid references plan_exercises(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz not null default now(),
  duration_seconds integer not null check (duration_seconds >= 0),
  repetitions integer not null check (repetitions >= 0),
  status text not null check (status in ('completed', 'stopped_early', 'skipped')),
  measurement_mode text not null check (measurement_mode in ('camera_prototype', 'manual_demo')),
  created_at timestamptz not null default now()
);

-- 5. SYMPTOM CHECKINS
create table if not exists symptom_checkins (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references profiles(id) on delete cascade,
  pain_score integer not null check (pain_score >= 0 and pain_score <= 10),
  symptoms jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

-- 6. KNOWLEDGE ARTICLES
create table if not exists knowledge_articles (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  content text not null,
  source_label text not null,
  source_url text,
  version text not null default '1.0',
  topic text not null,
  approval_status text not null default 'draft' check (approval_status in ('draft', 'approved', 'retired')),
  approved_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. ASSISTANT QUESTIONS
create table if not exists assistant_questions (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references profiles(id) on delete cascade,
  question text not null,
  answer text,
  source_article_ids uuid[],
  status text not null check (status in ('answered', 'unsupported_safe_fallback', 'emergency_escalation', 'error')),
  created_at timestamptz not null default now()
);

-- 8. CLINICIAN PATIENT ACCESS
create table if not exists clinician_patient_access (
  id uuid primary key default uuid_generate_v4(),
  clinician_id uuid not null references profiles(id) on delete cascade,
  patient_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  unique(clinician_id, patient_id)
);

-- 9. ALERTS
create table if not exists alerts (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references profiles(id) on delete cascade,
  category text not null check (category in ('clinical_review', 'engagement')),
  severity text not null check (severity in ('critical', 'urgent', 'moderate', 'low')),
  source_type text not null check (source_type in ('symptom_checkin', 'exercise_session', 'adherence_gap')),
  source_id uuid not null,
  reason text not null,
  status text not null default 'new' check (status in ('new', 'reviewed', 'acknowledged', 'closed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id)
);

-- 10. ALERT ACTIONS
create table if not exists alert_actions (
  id uuid primary key default uuid_generate_v4(),
  alert_id uuid not null references alerts(id) on delete cascade,
  clinician_id uuid not null references profiles(id) on delete cascade,
  action text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_recovery_plans_patient on recovery_plans(patient_id);
create index if not exists idx_exercise_sessions_patient_time on exercise_sessions(patient_id, started_at desc);
create index if not exists idx_symptom_checkins_patient_time on symptom_checkins(patient_id, created_at desc);
create index if not exists idx_alerts_patient_status_time on alerts(patient_id, status, created_at desc);
create index if not exists idx_cpa_clinician on clinician_patient_access(clinician_id, status);
create index if not exists idx_cpa_patient on clinician_patient_access(patient_id, status);
create index if not exists idx_knowledge_topic_status on knowledge_articles(topic, approval_status);

-- ROW LEVEL SECURITY (RLS)
alter table profiles enable row level security;
alter table recovery_plans enable row level security;
alter table plan_exercises enable row level security;
alter table exercise_sessions enable row level security;
alter table symptom_checkins enable row level security;
alter table knowledge_articles enable row level security;
alter table assistant_questions enable row level security;
alter table clinician_patient_access enable row level security;
alter table alerts enable row level security;
alter table alert_actions enable row level security;

-- Profiles: Users can view their own profile; clinicians can view patients they have access to
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

create policy "Clinicians can view assigned patient profiles" on profiles
  for select using (
    exists (
      select 1 from clinician_patient_access cpa
      where cpa.clinician_id = auth.uid()
        and cpa.patient_id = profiles.id
        and cpa.status = 'active'
    )
  );

-- Recovery Plans: Patients can view own; clinicians can view if authorized
create policy "Patients can view own plans" on recovery_plans
  for select using (auth.uid() = patient_id);

create policy "Clinicians can view authorized patient plans" on recovery_plans
  for select using (
    exists (
      select 1 from clinician_patient_access cpa
      where cpa.clinician_id = auth.uid()
        and cpa.patient_id = recovery_plans.patient_id
        and cpa.status = 'active'
    )
  );

-- Plan Exercises: Viewable if parent recovery plan is viewable
create policy "Users can view exercises of accessible plans" on plan_exercises
  for select using (
    exists (
      select 1 from recovery_plans rp
      where rp.id = plan_exercises.plan_id
        and (
          rp.patient_id = auth.uid()
          or exists (
            select 1 from clinician_patient_access cpa
            where cpa.clinician_id = auth.uid()
              and cpa.patient_id = rp.patient_id
              and cpa.status = 'active'
          )
        )
    )
  );

-- Exercise Sessions: Patient owns insert & select; clinician can view
create policy "Patients can insert own sessions" on exercise_sessions
  for insert with check (auth.uid() = patient_id);

create policy "Patients can view own sessions" on exercise_sessions
  for select using (auth.uid() = patient_id);

create policy "Clinicians can view authorized patient sessions" on exercise_sessions
  for select using (
    exists (
      select 1 from clinician_patient_access cpa
      where cpa.clinician_id = auth.uid()
        and cpa.patient_id = exercise_sessions.patient_id
        and cpa.status = 'active'
    )
  );

-- Symptom Checkins: Patient owns insert & select; clinician can view
create policy "Patients can insert own checkins" on symptom_checkins
  for insert with check (auth.uid() = patient_id);

create policy "Patients can view own checkins" on symptom_checkins
  for select using (auth.uid() = patient_id);

create policy "Clinicians can view authorized patient checkins" on symptom_checkins
  for select using (
    exists (
      select 1 from clinician_patient_access cpa
      where cpa.clinician_id = auth.uid()
        and cpa.patient_id = symptom_checkins.patient_id
        and cpa.status = 'active'
    )
  );

-- Knowledge Articles: Any authenticated user can read approved articles
create policy "Authenticated users can view approved articles" on knowledge_articles
  for select using (approval_status = 'approved');

-- Assistant Questions: Patient owns insert & select
create policy "Patients can insert own questions" on assistant_questions
  for insert with check (auth.uid() = patient_id);

create policy "Patients can view own questions" on assistant_questions
  for select using (auth.uid() = patient_id);

-- Clinician Patient Access: Visible to both parties
create policy "Participants can view access records" on clinician_patient_access
  for select using (auth.uid() = clinician_id or auth.uid() = patient_id);

-- Alerts: Clinicians view and update for authorized patients; patients can view own alerts
create policy "Patients can view own alerts" on alerts
  for select using (auth.uid() = patient_id);

create policy "Clinicians can view authorized patient alerts" on alerts
  for select using (
    exists (
      select 1 from clinician_patient_access cpa
      where cpa.clinician_id = auth.uid()
        and cpa.patient_id = alerts.patient_id
        and cpa.status = 'active'
    )
  );

create policy "Clinicians can update authorized patient alerts" on alerts
  for update using (
    exists (
      select 1 from clinician_patient_access cpa
      where cpa.clinician_id = auth.uid()
        and cpa.patient_id = alerts.patient_id
        and cpa.status = 'active'
    )
  );

-- Alert Actions: Authorized clinicians can insert & view
create policy "Clinicians can create alert actions" on alert_actions
  for insert with check (auth.uid() = clinician_id);

create policy "Clinicians can view alert actions" on alert_actions
  for select using (
    exists (
      select 1 from alerts a
      join clinician_patient_access cpa on cpa.patient_id = a.patient_id
      where a.id = alert_actions.alert_id
        and cpa.clinician_id = auth.uid()
        and cpa.status = 'active'
    )
  );
