# ReKnee AI — Product Requirements Document

## 1. Product Overview
ReKnee AI is a mobile-first recovery companion for people recovering at home after knee replacement. It connects a patient-facing recovery plan, camera-assisted exercise practice, daily symptom check-ins, a grounded recovery knowledge assistant, and a clinician review dashboard.

**MVP principle:** demonstrate one reliable end-to-end workflow rather than broad clinical functionality.

## 2. Problem
After discharge, patients may struggle to follow exercises, remember instructions, understand what information matters, and communicate concerns between follow-up visits. Clinicians have limited visibility into what happens at home.

## 3. Value Proposition
ReKnee AI makes the weeks after discharge more structured by:
- presenting approved recovery guidance in one place;
- helping patients document exercise sessions and symptoms;
- answering questions from an approved knowledge base;
- surfacing configurable review alerts to authorized clinicians.

ReKnee AI does not diagnose, prescribe, replace a clinician, or guarantee exercise correctness.

## 4. Target Users
### Primary: Patient
A person recovering at home after knee replacement who has an approved recovery plan.

### Secondary: Clinician
A surgeon, physiotherapist, or care-team member authorized to review a patient's recovery records.

### Optional future user: Family/caregiver
Only with explicit patient consent. Not required for MVP.

## 5. Core User Journeys
1. Patient opens recovery home → sees today's plan.
2. Patient starts the single supported exercise → grants camera permission → sees pose landmarks → completes/stops session → session is saved.
3. Patient submits daily check-in → structured record is saved.
4. Patient asks the recovery assistant → answer is grounded in approved content or clearly says it cannot answer.
5. A configured rule creates an alert when appropriate → clinician reviews the same record → records follow-up action.
6. Clinician views recent sessions and check-ins for an authorized patient.

## 6. User Stories
- As a patient, I want to see what I should do today so I do not have to search through instructions.
- As a patient, I want to record an exercise session so my progress is documented.
- As a patient, I want to report symptoms so my care team has context.
- As a patient, I want to ask questions about my approved instructions and see where answers came from.
- As a clinician, I want to review patient activity and symptom reports between visits.
- As a clinician, I want alerts to show why they were created and what record triggered them.
- As a clinician, I want to review/close alerts with an audit trail.

## 7. MVP Features
### Patient
- Recovery home
- One camera-assisted exercise
- Session timer/repetition prototype
- Daily symptom check-in
- Progress history
- Grounded recovery knowledge assistant
- Clear emergency/clinician escalation messaging where applicable

### Clinician
- Authorized patient list
- Patient recovery overview
- Session history
- Check-in history
- Rule-based alert queue
- Alert review and follow-up action

## 8. Functional Requirements
- Patient can view an assigned fictional/demo recovery plan.
- Patient can start camera only after explicit action.
- App can display MediaPipe pose landmarks when available.
- App can record session metadata without storing raw video.
- Patient can submit pain 0–10, structured symptoms, and notes.
- Assistant returns source references for substantive answers.
- Unsupported questions receive a safe fallback.
- Configured rules can create transparent alerts.
- Clinician can review only authorized patient records.
- Clinician actions are timestamped.
- Data persists after refresh when backend is configured.

## 9. Non-Functional Requirements
- Mobile-first responsive UI.
- HTTPS required for deployed camera use.
- Accessible labels, contrast, focus states, and keyboard navigation.
- Type-safe frontend/backend boundaries.
- RLS for patient data.
- No service-role or private AI keys in frontend.
- Clear loading, empty, success, and error states.
- Synthetic data for demonstrations.
- No raw camera-video persistence in MVP.

## 10. Pages
- `/` or patient home
- `/exercise`
- `/check-in`
- `/assistant`
- `/progress`
- `/clinician`
- `/clinician/patients/:id`
- `/clinician/alerts/:id`

## 11. Roles and Permissions
### Patient
Own recovery plan, sessions, check-ins, assistant history, and permitted educational content.

### Clinician
Only assigned/authorized patient records and clinical workflow actions.

### Demo/admin
Only for controlled development/demo environments; must not be treated as production authorization.

## 12. Data Requirements
Core entities: profiles, recovery_plans, plan_exercises, exercise_sessions, symptom_checkins, knowledge_articles, assistant_questions, alerts, alert_actions, clinician_patient_access.

## 13. Integrations
- Supabase Auth/Postgres/RLS
- MediaPipe Pose Landmarker
- Optional LLM provider through a protected server-side integration
- Vercel or equivalent HTTPS hosting

## 14. Safety Boundaries
- No diagnosis.
- No medication changes.
- No autonomous treatment decisions.
- No claims of clinically validated motion/form assessment.
- No automatic declaration that a patient is safe.
- Red-flag guidance must use clinician-reviewed/static content.
- Chest pain or difficulty breathing should lead to immediate emergency-care guidance rather than AI assessment.

## 15. Loading/Empty/Error States
Every data-driven page needs loading, empty, error, retry, and success states. Camera needs permission denied, unsupported browser, model loading/failure, poor detection, and cleanup states. Assistant needs no-results and provider-failure states.

## 16. MVP Scope
### In scope
One exercise, patient workflow, check-in, grounded assistant, clinician dashboard, deterministic alerts, persistence, auth/RLS, mobile-first UI.

### Out of scope
Multiple exercises, clinical-grade motion validation, diagnosis, medication management, autonomous treatment recommendations, family portal, real patient data, raw video storage, complex analytics, medical-device AR.

## 17. Success Criteria
A judge can complete the full synthetic patient journey without developer intervention:
home → exercise → saved session → check-in → assistant answer with source → alert → clinician review.

## 18. Assumptions / Approval Needed
- The first exercise and thresholds are demonstration configurations and require clinician approval before real use.
- Knowledge content is fictional/illustrative unless supplied by a qualified source.
- Exact authentication provider configuration is subject to implementation choice within the approved architecture.
