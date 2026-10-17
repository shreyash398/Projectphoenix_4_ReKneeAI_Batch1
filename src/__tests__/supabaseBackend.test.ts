import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Supabase Backend Migration & Schema Verification', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/001_initial_schema.sql');
  const seedPath = path.resolve(__dirname, '../../supabase/seed/seed.sql');

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  const seedSql = fs.readFileSync(seedPath, 'utf8');

  it('defines all 10 documented tables', () => {
    const requiredTables = [
      'profiles',
      'recovery_plans',
      'plan_exercises',
      'exercise_sessions',
      'symptom_checkins',
      'knowledge_articles',
      'assistant_questions',
      'clinician_patient_access',
      'alerts',
      'alert_actions',
    ];

    for (const table of requiredTables) {
      const tableRegex = new RegExp(`create table if not exists ${table}\\s*\\(`, 'i');
      expect(tableRegex.test(migrationSql), `Missing table: ${table}`).toBe(true);
    }
  });

  it('enforces required primary keys and foreign keys', () => {
    expect(migrationSql).toContain('profiles (\n  id uuid primary key references auth.users(id)');
    expect(migrationSql).toContain('recovery_plans (\n  id uuid primary key');
    expect(migrationSql).toContain('references profiles(id)');
    expect(migrationSql).toContain('on delete cascade');
    expect(migrationSql).toContain('unique (clinician_id, patient_id)');
  });

  it('enforces clinical constraints matching 04_DATABASE.md', () => {
    // Pain score 0..10
    expect(migrationSql).toContain('pain_score >= 0 and pain_score <= 10');
    // Non-negative exercise reps and duration
    expect(migrationSql).toContain('target_repetitions >= 0');
    expect(migrationSql).toContain('target_duration_seconds >= 0');
    expect(migrationSql).toContain('duration_seconds >= 0');
    expect(migrationSql).toContain('repetitions >= 0');
    // Role constraint
    expect(migrationSql).toContain("role in ('patient', 'clinician')");
    // Session status constraint
    expect(migrationSql).toContain("status in ('completed', 'stopped_early', 'skipped')");
    // Measurement mode constraint
    expect(migrationSql).toContain("measurement_mode in ('camera_prototype', 'manual_demo')");
    // Approved knowledge requires approver
    expect(migrationSql).toContain("approval_status != 'approved' or approved_by is not null");
  });

  it('creates all documented performance and lookup indexes', () => {
    const requiredIndexes = [
      'idx_recovery_plans_patient',
      'idx_plan_exercises_plan',
      'idx_exercise_sessions_patient_time',
      'idx_symptom_checkins_patient_time',
      'idx_knowledge_topic_status',
      'idx_assistant_questions_patient',
      'idx_cpa_clinician',
      'idx_cpa_patient',
      'idx_alerts_patient_status_time',
      'idx_alerts_clinician_queue',
      'idx_alert_actions_alert',
    ];

    for (const idx of requiredIndexes) {
      expect(migrationSql).toContain(idx);
    }
  });

  it('enables Row Level Security on all 10 tables', () => {
    const requiredTables = [
      'profiles',
      'recovery_plans',
      'plan_exercises',
      'exercise_sessions',
      'symptom_checkins',
      'knowledge_articles',
      'assistant_questions',
      'clinician_patient_access',
      'alerts',
      'alert_actions',
    ];

    for (const table of requiredTables) {
      expect(migrationSql).toContain(`alter table ${table} enable row level security;`);
    }
  });

  it('defines helper security definer functions for performant RLS checks', () => {
    expect(migrationSql).toContain('create or replace function is_authorized_clinician');
    expect(migrationSql).toContain('security definer');
    expect(migrationSql).toContain('create or replace function is_clinician');
  });

  it('defines granular RLS policies for patient ownership and authorized clinician access', () => {
    // Patient ownership
    expect(migrationSql).toContain('"Patients can view own plans"');
    expect(migrationSql).toContain('"Patients can insert own sessions"');
    expect(migrationSql).toContain('"Patients can insert own checkins"');
    expect(migrationSql).toContain('"Patients can view own checkins"');
    expect(migrationSql).toContain('"Patients can view own alerts"');

    // Clinician authorization
    expect(migrationSql).toContain('"Clinicians can view authorized patient plans"');
    expect(migrationSql).toContain('"Clinicians can view authorized patient sessions"');
    expect(migrationSql).toContain('"Clinicians can view authorized patient checkins"');
    expect(migrationSql).toContain('"Clinicians can view authorized patient alerts"');
    expect(migrationSql).toContain('"Clinicians can update authorized patient alerts"');
    expect(migrationSql).toContain('"Clinicians can create alert actions"');

    // Public / approved knowledge
    expect(migrationSql).toContain('"Authenticated users can view approved articles"');
  });

  it('contains safe synthetic seed data without real patient info', () => {
    // Demo patient
    expect(seedSql).toContain('p2222222-2222-2222-2222-222222222222');
    expect(seedSql).toContain('Eleanor Vance');
    // Demo clinician
    expect(seedSql).toContain('c1111111-1111-1111-1111-111111111111');
    expect(seedSql).toContain('Dr. Marcus Patel');
    // Approved plan & single MVP exercise
    expect(seedSql).toContain('Post-TKA Early Stage Knee Mobility Protocol');
    expect(seedSql).toContain('Seated Knee Flexion & Extension');
    // 4 Approved articles
    expect(seedSql).toContain('swelling_and_ice');
    expect(seedSql).toContain('exercise_pain');
    expect(seedSql).toContain('wound_care');
    expect(seedSql).toContain('emergency_dvt');
    // Demo alert
    expect(seedSql).toContain('44444444-4444-4444-4444-444444444444');
    expect(seedSql).toContain('clinical_review');
    expect(seedSql).toContain('urgent');
  });

  it('does not leak service-role keys in code or configuration', () => {
    const configPath = path.resolve(__dirname, '../../src/lib/config.ts');
    const configContent = fs.readFileSync(configPath, 'utf8');
    expect(configContent).not.toContain('service_role');
    expect(configContent).not.toContain('SUPABASE_SERVICE_ROLE');
  });
});
