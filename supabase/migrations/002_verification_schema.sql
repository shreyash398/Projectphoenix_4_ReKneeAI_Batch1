-- ReKnee AI: Doctor-Verified Recovery Activity Report & Verification Schema Migration
-- Migration 002: Adds recovery_verifications and verification_audit_actions tables
-- Strictly matches:
--   04_DATABASE.md
--   05_API.md
--   10_DATABASE_BACKEND.md
--   11_AUTH_AUTHORIZATION.md
--   16_SECURITY_AUDIT.md

-- ============================================================================
-- 11. RECOVERY VERIFICATIONS
-- ============================================================================
create table if not exists recovery_verifications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  clinician_id uuid not null references profiles(id) on delete cascade,
  recovery_plan_id uuid not null references recovery_plans(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'revoked')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  verification_date date,
  clinician_name text,
  clinician_designation text,
  license_identifier text,
  verification_note text,
  verification_id text unique,
  report_version text not null default '1.0',
  generated_at timestamptz,
  document_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_recovery_verifications_updated_at on recovery_verifications;
create trigger set_recovery_verifications_updated_at
  before update on recovery_verifications
  for each row execute function update_updated_at_column();

-- Indexes for fast query resolution
create index if not exists idx_verifications_patient on recovery_verifications(patient_id);
create index if not exists idx_verifications_clinician on recovery_verifications(clinician_id);
create index if not exists idx_verifications_status on recovery_verifications(status);
create index if not exists idx_verifications_code on recovery_verifications(verification_id);

-- Enable RLS
alter table recovery_verifications enable row level security;

-- Policies for recovery_verifications
create policy "Patients can insert verification requests for themselves" on recovery_verifications
  for insert with check (
    auth.uid() = patient_id and
    status = 'requested'
  );

create policy "Patients can view own verifications" on recovery_verifications
  for select using (auth.uid() = patient_id);

create policy "Clinicians can view verifications for authorized patients" on recovery_verifications
  for select using (
    is_authorized_clinician(recovery_verifications.patient_id) or
    auth.uid() = clinician_id
  );

create policy "Authorized clinicians can update verifications" on recovery_verifications
  for update using (
    is_authorized_clinician(recovery_verifications.patient_id) and
    is_clinician()
  );

-- ============================================================================
-- 12. VERIFICATION AUDIT ACTIONS
-- ============================================================================
create table if not exists verification_audit_actions (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references recovery_verifications(id) on delete cascade,
  actor_id uuid not null references profiles(id) on delete cascade,
  actor_role text not null check (actor_role in ('patient', 'clinician')),
  action text not null check (action in (
    'verification_requested',
    'clinician_opened_request',
    'approved',
    'rejected',
    'report_generated',
    'report_downloaded'
  )),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_verification_audit_vid on verification_audit_actions(verification_id);
create index if not exists idx_verification_audit_actor on verification_audit_actions(actor_id);

-- Enable RLS
alter table verification_audit_actions enable row level security;

-- Policies for verification_audit_actions
create policy "Users can view audit actions for their accessible verifications" on verification_audit_actions
  for select using (
    exists (
      select 1 from recovery_verifications rv
      where rv.id = verification_audit_actions.verification_id
        and (rv.patient_id = auth.uid() or is_authorized_clinician(rv.patient_id))
    )
  );

create policy "Authenticated users can insert audit actions" on verification_audit_actions
  for insert with check (auth.uid() = actor_id);
