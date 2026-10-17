# ReKnee AI — Database Specification

## Technology
Supabase PostgreSQL with Row Level Security.

## Tables

### profiles
- `id uuid primary key references auth.users(id)`
- `full_name text`
- `role text check in ('patient','clinician')`
- `created_at timestamptz`
- `updated_at timestamptz`

### recovery_plans
- `id uuid primary key`
- `patient_id uuid references profiles(id)`
- `title text not null`
- `status text`
- `start_date date`
- `end_date date`
- `approved_by uuid references profiles(id)`
- `created_at timestamptz`

### plan_exercises
- `id uuid primary key`
- `plan_id uuid references recovery_plans(id) on delete cascade`
- `name text`
- `instructions text`
- `target_repetitions integer`
- `target_duration_seconds integer`
- `sort_order integer`
- `created_at timestamptz`

### exercise_sessions
- `id uuid primary key`
- `patient_id uuid references profiles(id)`
- `plan_exercise_id uuid references plan_exercises(id)`
- `started_at timestamptz`
- `ended_at timestamptz`
- `duration_seconds integer`
- `repetitions integer`
- `status text`
- `measurement_mode text` — e.g. `camera_prototype`, `manual_demo`
- `created_at timestamptz`

### symptom_checkins
- `id uuid primary key`
- `patient_id uuid references profiles(id)`
- `pain_score integer check 0..10`
- `symptoms jsonb`
- `notes text`
- `created_at timestamptz`

### knowledge_articles
- `id uuid primary key`
- `title text`
- `content text`
- `source_label text`
- `source_url text nullable`
- `version text`
- `topic text`
- `approval_status text check in ('draft','approved','retired')`
- `approved_by uuid references profiles(id)`
- `created_at timestamptz`
- `updated_at timestamptz`

### assistant_questions
- `id uuid primary key`
- `patient_id uuid references profiles(id)`
- `question text`
- `answer text nullable`
- `source_article_ids uuid[] nullable`
- `status text`
- `created_at timestamptz`

### clinician_patient_access
- `id uuid primary key`
- `clinician_id uuid references profiles(id)`
- `patient_id uuid references profiles(id)`
- `status text`
- `created_at timestamptz`
- unique `(clinician_id, patient_id)`

### alerts
- `id uuid primary key`
- `patient_id uuid references profiles(id)`
- `category text check in ('clinical_review','engagement')`
- `severity text`
- `source_type text`
- `source_id uuid`
- `reason text`
- `status text`
- `created_at timestamptz`
- `reviewed_at timestamptz`
- `reviewed_by uuid references profiles(id)`

### alert_actions
- `id uuid primary key`
- `alert_id uuid references alerts(id) on delete cascade`
- `clinician_id uuid references profiles(id)`
- `action text`
- `notes text`
- `created_at timestamptz`

## Relationships
profiles 1→N recovery_plans
recovery_plans 1→N plan_exercises
profiles 1→N exercise_sessions
profiles 1→N symptom_checkins
profiles 1→N assistant_questions
profiles N↔N profiles through clinician_patient_access
profiles 1→N alerts
alerts 1→N alert_actions

## ER Diagram
```text
profiles
  ├── recovery_plans ── plan_exercises ── exercise_sessions
  ├── symptom_checkins
  ├── assistant_questions
  └── alerts ── alert_actions

profiles(clinician) ── clinician_patient_access ── profiles(patient)

knowledge_articles ── referenced by assistant_questions
```

## Constraints
- Pain score 0–10.
- Repetitions and duration cannot be negative.
- Role values constrained.
- Alert status constrained.
- Approved knowledge must have an approver before production use.
- Clinician access relationship unique per pair.

## Indexes
Index:
- `recovery_plans(patient_id)`
- `exercise_sessions(patient_id, started_at desc)`
- `symptom_checkins(patient_id, created_at desc)`
- `alerts(patient_id, status, created_at desc)`
- `clinician_patient_access(clinician_id, status)`
- `clinician_patient_access(patient_id, status)`
- `knowledge_articles(topic, approval_status)`

## Authorization
Patient policies restrict records to `auth.uid() = patient_id` where applicable.
Clinician policies require an active row in `clinician_patient_access`.
Knowledge articles exposed to patients must be approved.

## Sensitive Data
Treat symptom notes as sensitive health-related data. Minimize free text. Do not store camera frames or video in MVP. Use synthetic data for demonstrations.

## Migration Strategy
Version-controlled SQL migrations. Never edit applied production migrations in place. Add a new migration for changes.

## Seed Strategy
Create a clearly marked demo patient, demo clinician, recovery plan, one exercise, sample sessions/check-ins, approved illustrative knowledge articles, and one alert. No real patient data.

## Backup/Recovery
Use Supabase managed backups appropriate to the project tier. Before any destructive migration, verify backup availability. Document restoration procedure before production use.
