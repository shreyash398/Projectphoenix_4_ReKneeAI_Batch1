-- ReKnee AI: Initial Database Schema Migration
-- Strictly matches:
--   04_DATABASE.md
--   05_API.md
--   10_DATABASE_BACKEND.md
--   11_AUTH_AUTHORIZATION.md
--   16_SECURITY_AUDIT.md

-- Enable UUID extension (supported across standard PostgreSQL and Supabase)
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Helper function: Updated At trigger
create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 1. PROFILES
-- ============================================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  role text not null check (role in ('patient', 'clinician')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_profiles_updated_at on profiles;
create trigger set_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at_column();

-- Security trigger: Prevent client from tampering with/updating the role column on profiles
create or replace function prevent_profile_role_change()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'Changing user role is not permitted.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_role_spoofing on profiles;
create trigger prevent_role_spoofing
  before update on profiles
  for each row execute function prevent_profile_role_change();

-- ============================================================================
-- 2. RECOVERY PLANS
-- ============================================================================
create table if not exists recovery_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  status text not null default 'active' check (status in ('active', 'completed', 'paused', 'draft')),
  start_date date not null default current_date,
  end_date date,
  approved_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint check_plan_dates check (end_date is null or end_date >= start_date)
);

-- ============================================================================
-- 3. PLAN EXERCISES
-- ============================================================================
create table if not exists plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references recovery_plans(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  instructions text not null check (length(trim(instructions)) > 0),
  target_repetitions integer not null check (target_repetitions >= 0 and target_repetitions <= 100),
  target_duration_seconds integer not null check (target_duration_seconds >= 0 and target_duration_seconds <= 3600),
  sort_order integer not null default 1 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 4. EXERCISE SESSIONS
-- ============================================================================
create table if not exists exercise_sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  plan_exercise_id uuid references plan_exercises(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz not null default now(),
  duration_seconds integer not null check (duration_seconds >= 0 and duration_seconds <= 7200),
  repetitions integer not null check (repetitions >= 0 and repetitions <= 500),
  status text not null check (status in ('completed', 'stopped_early', 'skipped')),
  measurement_mode text not null check (measurement_mode in ('camera_prototype', 'manual_demo')),
  created_at timestamptz not null default now(),
  constraint check_session_times check (ended_at >= started_at)
);

-- ============================================================================
-- 5. SYMPTOM CHECKINS
-- ============================================================================
create table if not exists symptom_checkins (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  pain_score integer not null check (pain_score >= 0 and pain_score <= 10),
  symptoms jsonb not null default '{}'::jsonb,
  notes text check (notes is null or length(notes) <= 1000),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 6. KNOWLEDGE ARTICLES
-- ============================================================================
create table if not exists knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  content text not null check (length(trim(content)) > 0),
  source_label text not null check (length(trim(source_label)) > 0),
  source_url text,
  version text not null default '1.0',
  topic text not null check (length(trim(topic)) > 0),
  approval_status text not null default 'draft' check (approval_status in ('draft', 'approved', 'retired')),
  approved_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint check_approved_requires_approver check (
    approval_status != 'approved' or approved_by is not null
  )
);

drop trigger if exists set_knowledge_articles_updated_at on knowledge_articles;
create trigger set_knowledge_articles_updated_at
  before update on knowledge_articles
  for each row execute function update_updated_at_column();

-- ============================================================================
-- 7. ASSISTANT QUESTIONS
-- ============================================================================
create table if not exists assistant_questions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  question text not null check (length(trim(question)) > 0 and length(question) <= 1000),
  answer text,
  source_article_ids uuid[],
  status text not null check (status in ('answered', 'unsupported_safe_fallback', 'emergency_escalation', 'error')),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 8. CLINICIAN PATIENT ACCESS
-- ============================================================================
create table if not exists clinician_patient_access (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references profiles(id) on delete cascade,
  patient_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  constraint unique_clinician_patient unique (clinician_id, patient_id),
  constraint check_distinct_clinician_patient check (clinician_id <> patient_id)
);

-- ============================================================================
-- 9. ALERTS
-- ============================================================================
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  category text not null check (category in ('clinical_review', 'engagement')),
  severity text not null check (severity in ('critical', 'urgent', 'moderate', 'low')),
  source_type text not null check (source_type in ('symptom_checkin', 'exercise_session', 'adherence_gap')),
  source_id uuid not null,
  reason text not null check (length(trim(reason)) > 0),
  status text not null default 'new' check (status in ('new', 'reviewed', 'acknowledged', 'closed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id) on delete set null
);

-- ============================================================================
-- 10. ALERT ACTIONS
-- ============================================================================
create table if not exists alert_actions (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references alerts(id) on delete cascade,
  clinician_id uuid not null references profiles(id) on delete cascade,
  action text not null check (action in ('reviewed', 'contacted_patient', 'adjusted_protocol', 'escalated_to_surgeon', 'closed_with_note')),
  notes text check (notes is null or length(notes) <= 1000),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- PERFORMANCE & FILTERING INDEXES
-- ============================================================================
create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_recovery_plans_patient on recovery_plans(patient_id, status);
create index if not exists idx_plan_exercises_plan on plan_exercises(plan_id, sort_order);
create index if not exists idx_exercise_sessions_patient_time on exercise_sessions(patient_id, started_at desc);
create index if not exists idx_symptom_checkins_patient_time on symptom_checkins(patient_id, created_at desc);
create index if not exists idx_knowledge_topic_status on knowledge_articles(topic, approval_status);
create index if not exists idx_assistant_questions_patient on assistant_questions(patient_id, created_at desc);
create index if not exists idx_cpa_clinician on clinician_patient_access(clinician_id, status);
create index if not exists idx_cpa_patient on clinician_patient_access(patient_id, status);
create index if not exists idx_alerts_patient_status_time on alerts(patient_id, status, created_at desc);
create index if not exists idx_alerts_clinician_queue on alerts(status, severity, created_at desc);
create index if not exists idx_alert_actions_alert on alert_actions(alert_id, created_at desc);

-- ============================================================================
-- SECURITY DEFINER HELPER FUNCTIONS FOR RLS
-- ============================================================================
-- Helper 1: Check if auth user is an authorized clinician for a specific patient
create or replace function is_authorized_clinician(p_patient_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from clinician_patient_access cpa
    where cpa.clinician_id = auth.uid()
      and cpa.patient_id = p_patient_id
      and cpa.status = 'active'
  );
$$;

-- Helper 2: Check if current auth user has clinician role
create or replace function is_clinician()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from profiles
    where id = auth.uid()
      and role = 'clinician'
  );
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) ACTIVATION
-- ============================================================================
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

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- 1. PROFILES POLICIES
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

create policy "Clinicians can view assigned patient profiles" on profiles
  for select using (is_authorized_clinician(profiles.id));

create policy "Patients can view assigned clinician profiles" on profiles
  for select using (
    exists (
      select 1 from clinician_patient_access cpa
      where cpa.patient_id = auth.uid()
        and cpa.clinician_id = profiles.id
        and cpa.status = 'active'
    )
  );

create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 2. RECOVERY PLANS POLICIES
create policy "Patients can view own plans" on recovery_plans
  for select using (auth.uid() = patient_id);

create policy "Clinicians can view authorized patient plans" on recovery_plans
  for select using (is_authorized_clinician(recovery_plans.patient_id));

create policy "Clinicians can create recovery plans for assigned patients" on recovery_plans
  for insert with check (is_authorized_clinician(patient_id));

create policy "Clinicians can update recovery plans for assigned patients" on recovery_plans
  for update using (is_authorized_clinician(patient_id));

-- 3. PLAN EXERCISES POLICIES
create policy "Users can view exercises of accessible plans" on plan_exercises
  for select using (
    exists (
      select 1 from recovery_plans rp
      where rp.id = plan_exercises.plan_id
        and (rp.patient_id = auth.uid() or is_authorized_clinician(rp.patient_id))
    )
  );

create policy "Clinicians can manage plan exercises" on plan_exercises
  for all using (
    exists (
      select 1 from recovery_plans rp
      where rp.id = plan_exercises.plan_id
        and is_authorized_clinician(rp.patient_id)
    )
  );

-- 4. EXERCISE SESSIONS POLICIES
create policy "Patients can insert own sessions" on exercise_sessions
  for insert with check (auth.uid() = patient_id);

create policy "Patients can view own sessions" on exercise_sessions
  for select using (auth.uid() = patient_id);

create policy "Clinicians can view authorized patient sessions" on exercise_sessions
  for select using (is_authorized_clinician(exercise_sessions.patient_id));

-- 5. SYMPTOM CHECKINS POLICIES
create policy "Patients can insert own checkins" on symptom_checkins
  for insert with check (auth.uid() = patient_id);

create policy "Patients can view own checkins" on symptom_checkins
  for select using (auth.uid() = patient_id);

create policy "Clinicians can view authorized patient checkins" on symptom_checkins
  for select using (is_authorized_clinician(symptom_checkins.patient_id));

-- 6. KNOWLEDGE ARTICLES POLICIES
create policy "Authenticated users can view approved articles" on knowledge_articles
  for select using (approval_status = 'approved');

create policy "Clinicians can view all articles" on knowledge_articles
  for select using (is_clinician());

create policy "Clinicians can manage knowledge articles" on knowledge_articles
  for all using (is_clinician());

-- 7. ASSISTANT QUESTIONS POLICIES
create policy "Patients can insert own questions" on assistant_questions
  for insert with check (auth.uid() = patient_id);

create policy "Patients can view own questions" on assistant_questions
  for select using (auth.uid() = patient_id);

create policy "Clinicians can view authorized patient assistant questions" on assistant_questions
  for select using (is_authorized_clinician(assistant_questions.patient_id));

-- 8. CLINICIAN PATIENT ACCESS POLICIES
create policy "Participants can view access records" on clinician_patient_access
  for select using (auth.uid() = clinician_id or auth.uid() = patient_id);

create policy "Clinicians can insert access records" on clinician_patient_access
  for insert with check (auth.uid() = clinician_id);

create policy "Clinicians can update access records" on clinician_patient_access
  for update using (auth.uid() = clinician_id);

-- 9. ALERTS POLICIES
create policy "Patients can view own alerts" on alerts
  for select using (auth.uid() = patient_id);

create policy "Clinicians can view authorized patient alerts" on alerts
  for select using (is_authorized_clinician(alerts.patient_id));

create policy "Patients or authorized clinicians can insert alerts" on alerts
  for insert with check (auth.uid() = patient_id or is_authorized_clinician(patient_id));

create policy "Clinicians can update authorized patient alerts" on alerts
  for update using (is_authorized_clinician(alerts.patient_id));

-- 10. ALERT ACTIONS POLICIES
create policy "Clinicians can create alert actions" on alert_actions
  for insert with check (
    auth.uid() = clinician_id and exists (
      select 1 from alerts a
      where a.id = alert_actions.alert_id
        and is_authorized_clinician(a.patient_id)
    )
  );

create policy "Clinicians can view alert actions" on alert_actions
  for select using (
    exists (
      select 1 from alerts a
      where a.id = alert_actions.alert_id
        and is_authorized_clinician(a.patient_id)
    )
  );
