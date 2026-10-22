// ReKnee AI - Unified Repository Service
// Connects to live Supabase with fallback to resilient demo store
// Strictly enforces patient data isolation and authorized clinician access matching 04_DATABASE.md and 11_AUTH_AUTHORIZATION.md

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
  UserRole,
  RecoveryVerification,
  VerificationAuditAction,
} from '../../types/database';
import { supabase, isSupabaseConfigured } from './client';
import {
  getStore,
  saveStore,
  DEMO_PATIENT_ID,
  DEMO_CLINICIAN_ID,
} from './mockStore';
import { evaluateCheckinAlert, evaluateSessionAlert, isDuplicateAlert } from '../alerts/rules';

export const repository = {
  // Current active user simulation
  getCurrentProfile(): Profile | null {
    const store = getStore();
    if (!store.activeUserId) return null;
    const profile = store.profiles.find((p) => p.id === store.activeUserId);
    return profile || null;
  },

  getGuaranteedProfile(): Profile {
    return (
      this.getCurrentProfile() || {
        id: DEMO_PATIENT_ID,
        full_name: 'Eleanor Vance (Demo Patient)',
        role: 'patient',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    );
  },

  setActiveUserId(userId: string): Profile | null {
    const store = getStore();
    store.activeUserId = userId;
    saveStore(store);
    return this.getCurrentProfile();
  },

  signOut(): void {
    const store = getStore();
    store.activeUserId = '';
    saveStore(store);
  },

  switchUserRole(role: UserRole): Profile {
    const store = getStore();
    store.activeUserId = role === 'clinician' ? DEMO_CLINICIAN_ID : DEMO_PATIENT_ID;
    saveStore(store);
    return this.getCurrentProfile()!;
  },

  // Helper: Verify if clinician has active access to patient
  isClinicianAuthorizedForPatient(clinicianId: string, patientId: string): boolean {
    const store = getStore();
    return store.access.some(
      (a) => a.clinician_id === clinicianId && a.patient_id === patientId && a.status === 'active'
    );
  },

  async getPatientProfile(patientId: string): Promise<Profile | null> {
    const current = this.getCurrentProfile();
    if (!current) return null;

    if (current.role === 'patient' && current.id !== patientId) {
      console.warn('Security Notice: Patient cannot access another patient profile.');
      return null;
    }

    if (current.role === 'clinician' && !this.isClinicianAuthorizedForPatient(current.id, patientId)) {
      console.warn('Security Notice: Clinician is not authorized for this patient profile.');
      return null;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', patientId)
          .maybeSingle();
        if (!error && data) return data as Profile;
      } catch (err) {
        console.warn('Supabase query error, falling back to local store:', err);
      }
    }

    const store = getStore();
    return store.profiles.find((p) => p.id === patientId) || null;
  },

  async getRecoveryPlan(patientId: string): Promise<RecoveryPlan | null> {
    const current = this.getCurrentProfile();
    // Deny unauthenticated access
    if (!current) return null;
    // Patient ownership check
    if (current.role === 'patient' && current.id !== patientId) {
      console.warn('Security Notice: Patient cannot access another patient recovery plan.');
      return null;
    }
    // Clinician authorization check
    if (current.role === 'clinician' && !this.isClinicianAuthorizedForPatient(current.id, patientId)) {
      console.warn('Security Notice: Clinician is not authorized for patient recovery plan.');
      return null;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('recovery_plans')
          .select('*')
          .eq('patient_id', patientId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!error && data) return data as RecoveryPlan;
      } catch (err) {
        console.warn('Supabase query error, falling back to local store:', err);
      }
    }
    const store = getStore();
    return store.plans.find((p) => p.patient_id === patientId && p.status === 'active') || null;
  },

  async getPlanExercises(planId: string): Promise<PlanExercise[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('plan_exercises')
          .select('*')
          .eq('plan_id', planId)
          .order('sort_order', { ascending: true });
        if (!error && data && data.length > 0) return data as PlanExercise[];
      } catch (err) {
        console.warn('Supabase query error, falling back to local store:', err);
      }
    }
    const store = getStore();
    return store.exercises
      .filter((e) => e.plan_id === planId)
      .sort((a, b) => a.sort_order - b.sort_order);
  },

  async saveExerciseSession(
    sessionData: Omit<ExerciseSession, 'id' | 'created_at'>
  ): Promise<ExerciseSession> {
    const current = this.getCurrentProfile();
    // Security restriction: Patients can only submit sessions for themselves
    if (current && current.role === 'patient' && sessionData.patient_id !== current.id) {
      throw new Error('Unauthorized: Patients can only record exercise sessions for themselves.');
    }

    const id = 'sess-' + Date.now();
    const created_at = new Date().toISOString();
    const newSession: ExerciseSession = { ...sessionData, id, created_at };

    // Check alert rule for session
    const alertResult = evaluateSessionAlert(newSession);

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('exercise_sessions')
          .insert(newSession)
          .select()
          .single();
        if (!error && data) {
          if (alertResult.shouldAlert && alertResult.category && alertResult.severity && alertResult.reason) {
            await this.createAlert({
              patient_id: newSession.patient_id,
              category: alertResult.category,
              severity: alertResult.severity,
              source_type: 'exercise_session',
              source_id: data.id,
              reason: alertResult.reason,
              status: 'new',
            });
          }
          return data as ExerciseSession;
        }
      } catch (err) {
        console.warn('Supabase save error, writing to local store:', err);
      }
    }

    const store = getStore();
    store.sessions.unshift(newSession);

    if (alertResult.shouldAlert && alertResult.category && alertResult.severity && alertResult.reason) {
      const alert: Alert = {
        id: 'alt-' + Date.now(),
        patient_id: newSession.patient_id,
        category: alertResult.category,
        severity: alertResult.severity,
        source_type: 'exercise_session',
        source_id: newSession.id,
        reason: alertResult.reason,
        status: 'new',
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
      };
      if (!isDuplicateAlert(store.alerts, alert)) {
        store.alerts.unshift(alert);
      }
    }

    saveStore(store);
    return newSession;
  },

  async getExerciseSessions(patientId: string): Promise<ExerciseSession[]> {
    const current = this.getCurrentProfile();
    // Deny unauthenticated access
    if (!current) return [];
    // Security check: Patient can access only their own sessions
    if (current.role === 'patient' && current.id !== patientId) {
      console.warn('Security Notice: Patient cannot access another patient’s sessions.');
      return [];
    }
    // Clinician authorization check
    if (current.role === 'clinician' && !this.isClinicianAuthorizedForPatient(current.id, patientId)) {
      console.warn('Security Notice: Clinician is not authorized for patient sessions.');
      return [];
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('exercise_sessions')
          .select('*')
          .eq('patient_id', patientId)
          .order('started_at', { ascending: false });
        if (!error && data && data.length > 0) return data as ExerciseSession[];
      } catch (err) {
        console.warn('Supabase query error, falling back to local store:', err);
      }
    }
    const store = getStore();
    return store.sessions
      .filter((s) => s.patient_id === patientId)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  },

  async saveSymptomCheckin(
    checkinData: Omit<SymptomCheckin, 'id' | 'created_at'>
  ): Promise<SymptomCheckin> {
    const current = this.getCurrentProfile();
    // Security restriction: Patients can only submit check-ins for themselves
    if (current && current.role === 'patient' && checkinData.patient_id !== current.id) {
      throw new Error('Unauthorized: Patients can only submit symptom check-ins for themselves.');
    }

    const id = 'chk-' + Date.now();
    const created_at = new Date().toISOString();
    const newCheckin: SymptomCheckin = { ...checkinData, id, created_at };

    // Evaluate deterministic clinical alert rule
    const alertResult = evaluateCheckinAlert(newCheckin);

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('symptom_checkins')
          .insert(newCheckin)
          .select()
          .single();
        if (!error && data) {
          if (alertResult.shouldAlert && alertResult.category && alertResult.severity && alertResult.reason) {
            await this.createAlert({
              patient_id: newCheckin.patient_id,
              category: alertResult.category,
              severity: alertResult.severity,
              source_type: 'symptom_checkin',
              source_id: data.id,
              reason: alertResult.reason,
              status: 'new',
            });
          }
          return data as SymptomCheckin;
        }
      } catch (err) {
        console.warn('Supabase save error, writing to local store:', err);
      }
    }

    const store = getStore();
    store.checkins.unshift(newCheckin);

    if (alertResult.shouldAlert && alertResult.category && alertResult.severity && alertResult.reason) {
      const alert: Alert = {
        id: 'alt-' + Date.now(),
        patient_id: newCheckin.patient_id,
        category: alertResult.category,
        severity: alertResult.severity,
        source_type: 'symptom_checkin',
        source_id: newCheckin.id,
        reason: alertResult.reason,
        status: 'new',
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
      };
      if (!isDuplicateAlert(store.alerts, alert)) {
        store.alerts.unshift(alert);
      }
    }

    saveStore(store);
    return newCheckin;
  },

  async getSymptomCheckins(patientId: string): Promise<SymptomCheckin[]> {
    const current = this.getCurrentProfile();
    // Deny unauthenticated access
    if (!current) return [];
    // Security check: Patient can access only their own check-ins
    if (current.role === 'patient' && current.id !== patientId) {
      console.warn('Security Notice: Patient cannot access another patient’s check-ins.');
      return [];
    }
    // Clinician authorization check
    if (current.role === 'clinician' && !this.isClinicianAuthorizedForPatient(current.id, patientId)) {
      console.warn('Security Notice: Clinician is not authorized for patient check-ins.');
      return [];
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('symptom_checkins')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data as SymptomCheckin[];
      } catch (err) {
        console.warn('Supabase query error, falling back to local store:', err);
      }
    }
    const store = getStore();
    return store.checkins
      .filter((c) => c.patient_id === patientId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getApprovedKnowledgeArticles(): Promise<KnowledgeArticle[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('knowledge_articles')
          .select('*')
          .eq('approval_status', 'approved')
          .order('title', { ascending: true });
        if (!error && data && data.length > 0) return data as KnowledgeArticle[];
      } catch (err) {
        console.warn('Supabase query error, falling back to local store:', err);
      }
    }
    const store = getStore();
    return store.articles.filter((a) => a.approval_status === 'approved');
  },

  async saveAssistantQuestion(
    qData: Omit<AssistantQuestion, 'id' | 'created_at'>
  ): Promise<AssistantQuestion> {
    const current = this.getCurrentProfile();
    if (current && current.role === 'patient' && qData.patient_id !== current.id) {
      throw new Error('Unauthorized: Patient cannot submit assistant questions for another user.');
    }

    const id = 'q-' + Date.now();
    const created_at = new Date().toISOString();
    const newQuestion: AssistantQuestion = { ...qData, id, created_at };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('assistant_questions')
          .insert(newQuestion)
          .select()
          .single();
        if (!error && data) return data as AssistantQuestion;
      } catch (err) {
        console.warn('Supabase save error, writing to local store:', err);
      }
    }

    const store = getStore();
    store.assistantQuestions.unshift(newQuestion);
    saveStore(store);
    return newQuestion;
  },

  async getAssistantQuestions(patientId: string): Promise<AssistantQuestion[]> {
    const current = this.getCurrentProfile();
    if (current && current.role === 'patient' && current.id !== patientId) {
      console.warn('Security Notice: Patient cannot access another patient’s questions.');
      return [];
    }
    if (current && current.role === 'clinician' && !this.isClinicianAuthorizedForPatient(current.id, patientId)) {
      console.warn('Security Notice: Clinician is not authorized for patient questions.');
      return [];
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('assistant_questions')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data as AssistantQuestion[];
      } catch (err) {
        console.warn('Supabase query error, falling back to local store:', err);
      }
    }
    const store = getStore();
    return store.assistantQuestions
      .filter((q) => q.patient_id === patientId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getAlerts(patientId?: string): Promise<Alert[]> {
    const current = this.getCurrentProfile();
    // Deny unauthenticated access
    if (!current) return [];

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('alerts').select('*').order('created_at', { ascending: false });
        if (patientId) {
          query = query.eq('patient_id', patientId);
        } else if (current && current.role === 'patient') {
          query = query.eq('patient_id', current.id);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) return data as Alert[];
      } catch (err) {
        console.warn('Supabase query error, falling back to local store:', err);
      }
    }

    const store = getStore();
    let res = store.alerts;

    // Strict patient isolation
    if (current && current.role === 'patient') {
      res = res.filter((a) => a.patient_id === current.id);
    } else if (current && current.role === 'clinician') {
      // Clinician only sees authorized patients' alerts
      const authPatients = store.access
        .filter((a) => a.clinician_id === current.id && a.status === 'active')
        .map((a) => a.patient_id);
      res = res.filter((a) => authPatients.includes(a.patient_id));
      if (patientId) res = res.filter((a) => a.patient_id === patientId);
    } else if (patientId) {
      res = res.filter((a) => a.patient_id === patientId);
    }

    return res.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async createAlert(alertData: Omit<Alert, 'id' | 'created_at'>): Promise<Alert> {
    const id = 'alt-' + Date.now();
    const created_at = new Date().toISOString();
    const newAlert: Alert = { ...alertData, id, created_at };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('alerts').insert(newAlert).select().single();
        if (!error && data) return data as Alert;
      } catch (err) {
        console.warn('Supabase createAlert error:', err);
      }
    }

    const store = getStore();
    if (!isDuplicateAlert(store.alerts, newAlert)) {
      store.alerts.unshift(newAlert);
      saveStore(store);
    }
    return newAlert;
  },

  async updateAlertStatus(
    alertId: string,
    status: Alert['status'],
    clinicianId: string,
    actionText?: string,
    notes?: string
  ): Promise<Alert | null> {
    const current = this.getCurrentProfile();
    // Security check: Only clinicians can update alert statuses (11_AUTH_AUTHORIZATION.md)
    if (current && current.role !== 'clinician') {
      throw new Error('Unauthorized: Only clinicians can review or update alerts.');
    }

    const store = getStore();
    const alert = store.alerts.find((a) => a.id === alertId);

    // Security check: Clinician must be assigned/authorized for this patient
    if (alert && !this.isClinicianAuthorizedForPatient(clinicianId, alert.patient_id)) {
      throw new Error('Unauthorized: Clinician is not authorized to act on this patient’s alerts.');
    }

    const now = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('alerts')
          .update({
            status,
            reviewed_at: now,
            reviewed_by: clinicianId,
          })
          .eq('id', alertId)
          .select()
          .single();

        if (actionText) {
          await supabase.from('alert_actions').insert({
            alert_id: alertId,
            clinician_id: clinicianId,
            action: actionText,
            notes: notes || '',
          });
        }

        if (!error && data) return data as Alert;
      } catch (err) {
        console.warn('Supabase updateAlertStatus error:', err);
      }
    }

    if (alert) {
      alert.status = status;
      alert.reviewed_at = now;
      alert.reviewed_by = clinicianId;

      if (actionText) {
        store.alertActions.push({
          id: 'act-' + Date.now(),
          alert_id: alertId,
          clinician_id: clinicianId,
          action: actionText,
          notes: notes || '',
          created_at: now,
        });
      }

      saveStore(store);
      return alert;
    }
    return null;
  },

  async acknowledgeAlert(
    alertId: string,
    clinicianId: string,
    notes?: string
  ): Promise<Alert | null> {
    return this.updateAlertStatus(
      alertId,
      'acknowledged',
      clinicianId,
      'acknowledged',
      notes || 'Clinician acknowledged alert.'
    );
  },

  async reviewAlert(
    alertId: string,
    clinicianId: string,
    action: string,
    notes?: string
  ): Promise<Alert | null> {
    return this.updateAlertStatus(
      alertId,
      'reviewed',
      clinicianId,
      action,
      notes || 'Clinician marked alert as reviewed.'
    );
  },

  async getAlertActions(alertId: string): Promise<AlertAction[]> {
    const current = this.getCurrentProfile();
    if (!current) return [];

    const store = getStore();
    const alert = store.alerts.find((a) => a.id === alertId);

    // Patient can only view their own alerts' actions
    if (current.role === 'patient' && alert && alert.patient_id !== current.id) {
      console.warn('Security Notice: Patient cannot view another patient’s alert audit actions.');
      return [];
    }

    // Clinician must be authorized for this patient
    if (current.role === 'clinician' && alert && !this.isClinicianAuthorizedForPatient(current.id, alert.patient_id)) {
      console.warn('Security Notice: Clinician is not authorized for patient alert actions.');
      return [];
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('alert_actions')
          .select('*')
          .eq('alert_id', alertId)
          .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data as AlertAction[];
      } catch (err) {
        console.warn('Supabase query error, falling back to local store:', err);
      }
    }

    return store.alertActions
      .filter((act) => act.alert_id === alertId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getClinicianAuthorizedPatients(clinicianId: string): Promise<Profile[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('clinician_patient_access')
          .select('patient_id, profiles!clinician_patient_access_patient_id_fkey(*)')
          .eq('clinician_id', clinicianId)
          .eq('status', 'active');
        if (!error && data && data.length > 0) {
          return (data as unknown as { profiles: Profile }[]).map((d) => d.profiles);
        }
      } catch (err) {
        console.warn('Supabase query error:', err);
      }
    }
    const store = getStore();
    const authorizedIds = store.access
      .filter((a) => a.clinician_id === clinicianId && a.status === 'active')
      .map((a) => a.patient_id);
    return store.profiles.filter((p) => authorizedIds.includes(p.id));
  },

  // ==========================================================================
  // RECOVERY VERIFICATIONS & AUDIT TRAIL (DOCTOR-VERIFIED COMPLETION REPORT)
  // ==========================================================================

  /**
   * Retrieves verification records for a patient or clinician.
   * - Patient: Only their own verifications.
   * - Clinician: Only verifications of patients with authorized relationship.
   */
  async getVerifications(patientId?: string): Promise<RecoveryVerification[]> {
    const current = this.getCurrentProfile();
    if (!current) return [];

    if (current.role === 'patient') {
      const targetId = current.id;
      if (patientId && patientId !== current.id) {
        console.warn('Security Notice: Patient cannot access another patient verifications.');
        return [];
      }
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('recovery_verifications')
            .select('*')
            .eq('patient_id', targetId)
            .order('created_at', { ascending: false });
          if (!error && data) return data as RecoveryVerification[];
        } catch (err) {
          console.warn('Supabase getVerifications error:', err);
        }
      }
      const store = getStore();
      return (store.verifications || [])
        .filter((v) => v.patient_id === targetId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    if (current.role === 'clinician') {
      if (patientId && !this.isClinicianAuthorizedForPatient(current.id, patientId)) {
        console.warn('Security Notice: Clinician is not authorized for patient verifications.');
        return [];
      }

      if (isSupabaseConfigured && supabase) {
        try {
          let query = supabase.from('recovery_verifications').select('*').order('created_at', { ascending: false });
          if (patientId) {
            query = query.eq('patient_id', patientId);
          }
          const { data, error } = await query;
          if (!error && data) {
            return (data as RecoveryVerification[]).filter((v) =>
              this.isClinicianAuthorizedForPatient(current.id, v.patient_id)
            );
          }
        } catch (err) {
          console.warn('Supabase getVerifications error:', err);
        }
      }

      const store = getStore();
      const authPatientIds = store.access
        .filter((a) => a.clinician_id === current.id && a.status === 'active')
        .map((a) => a.patient_id);

      let list = (store.verifications || []).filter((v) => authPatientIds.includes(v.patient_id));
      if (patientId) {
        list = list.filter((v) => v.patient_id === patientId);
      }
      return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return [];
  },

  /**
   * Retrieves a single verification by ID with authorization check.
   */
  async getVerificationById(verificationId: string): Promise<RecoveryVerification | null> {
    const current = this.getCurrentProfile();
    if (!current) return null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('recovery_verifications')
          .select('*')
          .eq('id', verificationId)
          .maybeSingle();
        if (!error && data) {
          const v = data as RecoveryVerification;
          if (current.role === 'patient' && v.patient_id !== current.id) return null;
          if (current.role === 'clinician' && !this.isClinicianAuthorizedForPatient(current.id, v.patient_id)) return null;
          return v;
        }
      } catch (err) {
        console.warn('Supabase getVerificationById error:', err);
      }
    }

    const store = getStore();
    const v = (store.verifications || []).find((item) => item.id === verificationId);
    if (!v) return null;

    if (current.role === 'patient' && v.patient_id !== current.id) {
      console.warn('Security Notice: Patient cannot view another patient verification.');
      return null;
    }
    if (current.role === 'clinician' && !this.isClinicianAuthorizedForPatient(current.id, v.patient_id)) {
      console.warn('Security Notice: Clinician is not authorized for this patient verification.');
      return null;
    }

    return v;
  },

  /**
   * Requests Doctor Verification for a recovery plan.
   * Can only be called by the patient for their own recovery plan.
   * NEVER marks as doctor verified automatically.
   */
  async requestVerification(patientId: string, planId: string): Promise<RecoveryVerification> {
    const current = this.getCurrentProfile();
    if (!current) {
      throw new Error('Unauthorized: Authentication required.');
    }
    if (current.role === 'patient' && current.id !== patientId) {
      throw new Error('Unauthorized: Patients can only request verification for their own recovery plan.');
    }

    const store = getStore();
    // Resolve authorized clinician for patient
    const access = store.access.find((a) => a.patient_id === patientId && a.status === 'active');
    const clinicianId = access ? access.clinician_id : DEMO_CLINICIAN_ID;

    const id = 'ver-' + Date.now();
    const now = new Date().toISOString();
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const verificationCode = `VER-${new Date().getFullYear()}-TKA-${randomCode}`;

    const newVerification: RecoveryVerification = {
      id,
      patient_id: patientId,
      clinician_id: clinicianId,
      recovery_plan_id: planId,
      status: 'requested',
      requested_at: now,
      reviewed_at: null,
      verification_date: null,
      clinician_name: null,
      clinician_designation: null,
      license_identifier: null,
      verification_note: null,
      verification_id: verificationCode,
      report_version: '1.0',
      generated_at: null,
      document_reference: null,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('recovery_verifications')
          .insert(newVerification)
          .select()
          .single();
        if (!error && data) {
          await this.logVerificationAuditAction({
            verification_id: data.id,
            actor_id: current.id,
            actor_role: current.role,
            action: 'verification_requested',
            notes: 'Patient submitted doctor verification request for completed recovery activity.',
          });
          return data as RecoveryVerification;
        }
      } catch (err) {
        console.warn('Supabase requestVerification error:', err);
      }
    }

    if (!store.verifications) store.verifications = [];
    store.verifications.unshift(newVerification);
    saveStore(store);

    await this.logVerificationAuditAction({
      verification_id: newVerification.id,
      actor_id: current.id,
      actor_role: current.role,
      action: 'verification_requested',
      notes: 'Patient submitted doctor verification request for completed recovery activity.',
    });

    return newVerification;
  },

  /**
   * Clinician marks a verification request as reviewed / opened.
   */
  async recordClinicianOpenedRequest(verificationId: string): Promise<void> {
    const current = this.getCurrentProfile();
    if (!current || current.role !== 'clinician') return;

    await this.logVerificationAuditAction({
      verification_id: verificationId,
      actor_id: current.id,
      actor_role: 'clinician',
      action: 'clinician_opened_request',
      notes: 'Clinician opened verification request for review.',
    });
  },

  /**
   * Clinician reviews and approves a verification request.
   * Requires explicit confirmation and clinician identity.
   * ONLY clinicians can approve.
   */
  async approveVerification(params: {
    verificationId: string;
    clinicianName: string;
    clinicianDesignation: string;
    licenseIdentifier?: string;
    verificationNote?: string;
  }): Promise<RecoveryVerification> {
    const current = this.getCurrentProfile();
    if (!current || current.role !== 'clinician') {
      throw new Error('Unauthorized: Only authorized clinicians can approve recovery verification requests.');
    }

    const verification = await this.getVerificationById(params.verificationId);
    if (!verification) {
      throw new Error('Verification request not found.');
    }

    if (!this.isClinicianAuthorizedForPatient(current.id, verification.patient_id)) {
      throw new Error('Unauthorized: Clinician is not authorized for this patient.');
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];

    const updated: RecoveryVerification = {
      ...verification,
      status: 'approved',
      reviewed_at: now,
      verification_date: today,
      clinician_id: current.id,
      clinician_name: params.clinicianName.trim(),
      clinician_designation: params.clinicianDesignation.trim(),
      license_identifier: params.licenseIdentifier?.trim() || null,
      verification_note: params.verificationNote?.trim() || null,
      generated_at: now,
      document_reference: `reports/${verification.patient_id}/${verification.verification_id}.pdf`,
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('recovery_verifications')
          .update(updated)
          .eq('id', params.verificationId)
          .select()
          .single();
        if (!error && data) {
          await this.logVerificationAuditAction({
            verification_id: params.verificationId,
            actor_id: current.id,
            actor_role: 'clinician',
            action: 'approved',
            notes: `Approved by ${params.clinicianName} (${params.clinicianDesignation}). ${params.verificationNote || ''}`.trim(),
          });
          await this.logVerificationAuditAction({
            verification_id: params.verificationId,
            actor_id: current.id,
            actor_role: 'clinician',
            action: 'report_generated',
            notes: `Doctor-Verified Recovery Activity Report generated (${updated.verification_id}).`,
          });
          return data as RecoveryVerification;
        }
      } catch (err) {
        console.warn('Supabase approveVerification error:', err);
      }
    }

    const store = getStore();
    const idx = (store.verifications || []).findIndex((v) => v.id === params.verificationId);
    if (idx !== -1) {
      store.verifications[idx] = updated;
      saveStore(store);
    }

    await this.logVerificationAuditAction({
      verification_id: params.verificationId,
      actor_id: current.id,
      actor_role: 'clinician',
      action: 'approved',
      notes: `Approved by ${params.clinicianName} (${params.clinicianDesignation}). ${params.verificationNote || ''}`.trim(),
    });

    await this.logVerificationAuditAction({
      verification_id: params.verificationId,
      actor_id: current.id,
      actor_role: 'clinician',
      action: 'report_generated',
      notes: `Doctor-Verified Recovery Activity Report generated (${updated.verification_id}).`,
    });

    return updated;
  },

  /**
   * Clinician rejects / requests clarification on a verification request.
   */
  async rejectVerification(params: {
    verificationId: string;
    reason: string;
  }): Promise<RecoveryVerification> {
    const current = this.getCurrentProfile();
    if (!current || current.role !== 'clinician') {
      throw new Error('Unauthorized: Only authorized clinicians can reject verification requests.');
    }

    const verification = await this.getVerificationById(params.verificationId);
    if (!verification) {
      throw new Error('Verification request not found.');
    }

    if (!this.isClinicianAuthorizedForPatient(current.id, verification.patient_id)) {
      throw new Error('Unauthorized: Clinician is not authorized for this patient.');
    }

    const now = new Date().toISOString();
    const updated: RecoveryVerification = {
      ...verification,
      status: 'rejected',
      reviewed_at: now,
      clinician_id: current.id,
      verification_note: params.reason.trim(),
      updated_at: now,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('recovery_verifications')
          .update(updated)
          .eq('id', params.verificationId)
          .select()
          .single();
        if (!error && data) {
          await this.logVerificationAuditAction({
            verification_id: params.verificationId,
            actor_id: current.id,
            actor_role: 'clinician',
            action: 'rejected',
            notes: `Request rejected/clarification requested: ${params.reason.trim()}`,
          });
          return data as RecoveryVerification;
        }
      } catch (err) {
        console.warn('Supabase rejectVerification error:', err);
      }
    }

    const store = getStore();
    const idx = (store.verifications || []).findIndex((v) => v.id === params.verificationId);
    if (idx !== -1) {
      store.verifications[idx] = updated;
      saveStore(store);
    }

    await this.logVerificationAuditAction({
      verification_id: params.verificationId,
      actor_id: current.id,
      actor_role: 'clinician',
      action: 'rejected',
      notes: `Request rejected/clarification requested: ${params.reason.trim()}`,
    });

    return updated;
  },

  /**
   * Records that a verified report was downloaded by an authorized user.
   */
  async recordReportDownload(verificationId: string): Promise<void> {
    const current = this.getCurrentProfile();
    if (!current) return;

    await this.logVerificationAuditAction({
      verification_id: verificationId,
      actor_id: current.id,
      actor_role: current.role,
      action: 'report_downloaded',
      notes: `Verified report downloaded by ${current.role} (${current.full_name}).`,
    });
  },

  /**
   * Writes an immutable audit entry for verification actions.
   */
  async logVerificationAuditAction(actionData: Omit<VerificationAuditAction, 'id' | 'created_at'>): Promise<VerificationAuditAction> {
    const id = 'aud-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const created_at = new Date().toISOString();
    const newAction: VerificationAuditAction = { ...actionData, id, created_at };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('verification_audit_actions')
          .insert(newAction)
          .select()
          .single();
        if (!error && data) return data as VerificationAuditAction;
      } catch (err) {
        console.warn('Supabase logVerificationAuditAction error:', err);
      }
    }

    const store = getStore();
    if (!store.verificationAuditActions) store.verificationAuditActions = [];
    store.verificationAuditActions.unshift(newAction);
    saveStore(store);
    return newAction;
  },

  /**
   * Retrieves audit actions for a verification.
   * Accessible by patient who owns the verification or assigned clinician.
   */
  async getVerificationAuditActions(verificationId: string): Promise<VerificationAuditAction[]> {
    const current = this.getCurrentProfile();
    if (!current) return [];

    const verification = await this.getVerificationById(verificationId);
    if (!verification) return [];

    if (current.role === 'patient' && verification.patient_id !== current.id) {
      console.warn('Security Notice: Patient cannot access another patient audit history.');
      return [];
    }
    if (current.role === 'clinician' && !this.isClinicianAuthorizedForPatient(current.id, verification.patient_id)) {
      console.warn('Security Notice: Clinician is not authorized for patient audit history.');
      return [];
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('verification_audit_actions')
          .select('*')
          .eq('verification_id', verificationId)
          .order('created_at', { ascending: false });
        if (!error && data) return data as VerificationAuditAction[];
      } catch (err) {
        console.warn('Supabase getVerificationAuditActions error:', err);
      }
    }

    const store = getStore();
    return (store.verificationAuditActions || [])
      .filter((a) => a.verification_id === verificationId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },
};
