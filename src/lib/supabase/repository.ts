// ReKnee AI - Unified Repository Service
// Connects to live Supabase with fallback to resilient demo store

import {
  Profile,
  RecoveryPlan,
  PlanExercise,
  ExerciseSession,
  SymptomCheckin,
  KnowledgeArticle,
  AssistantQuestion,
  Alert,
  UserRole,
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
  getCurrentProfile(): Profile {
    const store = getStore();
    const profile = store.profiles.find((p) => p.id === store.activeUserId);
    return (
      profile || {
        id: DEMO_PATIENT_ID,
        full_name: 'Eleanor Vance (Demo Patient)',
        role: 'patient',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    );
  },

  switchUserRole(role: UserRole): Profile {
    const store = getStore();
    store.activeUserId = role === 'clinician' ? DEMO_CLINICIAN_ID : DEMO_PATIENT_ID;
    saveStore(store);
    return this.getCurrentProfile();
  },

  async getRecoveryPlan(patientId: string): Promise<RecoveryPlan | null> {
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
        if (!error && data) return data as PlanExercise[];
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
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('exercise_sessions')
          .select('*')
          .eq('patient_id', patientId)
          .order('started_at', { ascending: false });
        if (!error && data) return data as ExerciseSession[];
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
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('symptom_checkins')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false });
        if (!error && data) return data as SymptomCheckin[];
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
        if (!error && data) return data as KnowledgeArticle[];
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
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('assistant_questions')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false });
        if (!error && data) return data as AssistantQuestion[];
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
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('alerts').select('*').order('created_at', { ascending: false });
        if (patientId) query = query.eq('patient_id', patientId);
        const { data, error } = await query;
        if (!error && data) return data as Alert[];
      } catch (err) {
        console.warn('Supabase query error, falling back to local store:', err);
      }
    }
    const store = getStore();
    let res = store.alerts;
    if (patientId) res = res.filter((a) => a.patient_id === patientId);
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

    const store = getStore();
    const alert = store.alerts.find((a) => a.id === alertId);
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

  async getClinicianAuthorizedPatients(clinicianId: string): Promise<Profile[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('clinician_patient_access')
          .select('patient_id, profiles!clinician_patient_access_patient_id_fkey(*)')
          .eq('clinician_id', clinicianId)
          .eq('status', 'active');
        if (!error && data) {
          return data.map((d: any) => d.profiles) as Profile[];
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
};
