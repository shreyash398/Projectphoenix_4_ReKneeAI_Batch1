# ReKnee AI — Security Audit & Hardening

## Threat Model
Sensitive areas:
- authentication;
- patient symptom data;
- clinician access;
- assistant content;
- secrets;
- database policies;
- camera data.

## Audit Checklist
### Authentication
- protected routes;
- session handling;
- logout;
- expired session.

### Authorization
- RLS enabled;
- patient ownership;
- clinician-patient relationship;
- no client-only role checks.

### Secrets
- no `.env` in Git;
- no provider keys in frontend;
- no Supabase service-role key in browser.

### Input Security
- validate IDs;
- validate numeric ranges;
- limit free-text length;
- safely render assistant output;
- prevent XSS through untrusted content.

### Data
- minimize free text;
- no raw camera video;
- synthetic demo data;
- safe logs.

### API Abuse
- rate limit assistant endpoint;
- bounded queries;
- avoid uncontrolled expensive requests.

### Dependencies
- audit known vulnerabilities;
- remove unused packages.

## Severity
Critical / High / Medium / Low / Info.

## Release Blockers
Any unauthorized patient data access, exposed secret, destructive data issue, or authentication bypass blocks release.

---

## Completed Security Audit Report & Findings

### 1. Authentication
- **Login / Credentials**: Implemented via Supabase Auth with secure email/password and fallback demo mode. No credentials or passwords are logged.
- **Logout**: `AuthContext.signOut` cleanly purges Supabase sessions and local store active identifiers.
- **Session Handling**: Uses Supabase managed sessions (`supabase.auth.getSession()` & `onAuthStateChange`). Token storage is handled in secure client storage by Supabase SDK.
- **Expired Sessions**: `TOKEN_REFRESHED` event failure is caught, resetting session state and displaying re-authentication notice. Simulation helper `simulateSessionExpired()` is verified.
- **Status**: PASSED.

### 2. Authorization
- **Patient Ownership**: Database RLS enforces `auth.uid() = patient_id` across `recovery_plans`, `exercise_sessions`, `symptom_checkins`, and `assistant_questions`. Client repository additionally checks and throws on mismatch.
- **Clinician Access**: Only authorized pairs in `clinician_patient_access` can access patient charts; enforced via SQL function `is_authorized_clinician(patient_id)` and client repository `isClinicianAuthorizedForPatient`.
- **Unauthorized Patient Access**: Patients cannot query or modify another patient's data. Security notice is raised and request is denied.
- **Direct Object Reference (IDOR)**: URL navigation to unassigned patient charts (`/clinician/patients/:id`) triggers an explicit access check; unauthorized requests display an Access Restricted boundary screen.
- **Status**: PASSED.

### 3. Database
- **RLS**: Row Level Security is explicitly activated on all 10 tables (`profiles`, `recovery_plans`, `plan_exercises`, `exercise_sessions`, `symptom_checkins`, `knowledge_articles`, `assistant_questions`, `clinician_patient_access`, `alerts`, `alert_actions`).
- **Public Access**: Denied across all tables; only authenticated users have access matching policies.
- **Excessive Permissions**: Role tampering trigger `prevent_profile_role_change()` prevents client escalation from patient to clinician.
- **Unsafe Policies**: All policies utilize security-definer helper functions and strict user ID matching.
- **Sensitive Columns**: No passwords, SSNs, or payment data stored. Symptom notes length bounded to ≤1000 chars.
- **Status**: PASSED.

### 4. Frontend
- **Exposed Secrets**: No API keys or service-role keys bundled in frontend. Only public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are exposed.
- **Environment Variables**: `.env` is properly ignored in `.gitignore` and untracked in Git. Server-only keys (`LLM_API_KEY`, `LLM_ENDPOINT`) are strictly server-side.
- **Unsafe HTML / XSS**: No `dangerouslySetInnerHTML`, `innerHTML`, or `eval()` present. React text escaping prevents XSS. External clinical citations hardened with `rel="noopener noreferrer"`.
- **Sensitive Data Leakage**: Error boundaries prevent component stack traces from leaking sensitive states.
- **Status**: PASSED.

### 5. API
- **Validation**: Payload structure, type checking, and length limits enforced (500 chars for questions, 10KB payload limit in serverless function).
- **Abuse Protection**: Sliding window rate limiter (12 requests/min) implemented with prompt injection blocking for safety bypass attempts.
- **Rate Limit Storage**: Automatic memory pruning added to prevent memory exhaustion attacks.
- **Error Leakage**: Internal error details and parser stack traces are sanitized to safe generic responses.
- **LLM Key Exposure**: Private keys (`LLM_API_KEY`) remain strictly on server; serverless endpoint communicates with provider.
- **Status**: PASSED.

### 6. Camera & Vision
- **Raw Video Storage**: Zero raw frames, video streams, or canvas images are persisted to disk, local storage, or network.
- **Permission Handling**: Camera starts strictly on explicit user action; permission rejection handled gracefully with informative guidance.
- **Cleanup**: MediaStream tracks stopped, canvas animation frame canceled, and MediaPipe PoseLandmarker closed upon exit/unmount.
- **Unnecessary Media Persistence**: Only discrete numerical aggregates (reps, duration, mode) saved.
- **Status**: PASSED.

### 7. Logging
- **Passwords & Tokens**: Zero credential or token logging.
- **API Keys**: Keys are never logged in console or API handlers.
- **Full Symptom Notes**: Patient symptom notes are excluded from client console statements.
- **Raw Camera Frames**: Vision pipeline runs purely in memory without frame logging.
- **Status**: PASSED.

---

## Remaining Findings Classification

| Severity | Item | Description | Mitigation / Remediation |
| :--- | :--- | :--- | :--- |
| **CRITICAL** | None | Zero critical blockers discovered. | N/A |
| **HIGH** | None | Zero high security vulnerabilities in production runtime code. | N/A |
| **MEDIUM** | Dev Toolchain Vulnerabilities (`vitest`, `tinypool`) | `npm audit` flagged devDependencies vulnerabilities in Vitest/Tinypool test runner. | Does not affect production bundle or deployed Vercel application. Upgrade Vitest to v5.x in future maintenance cycle. |
| **LOW** | Client-side Session State in Demo Mode | Demo mode fallback stores active demo patient/clinician ID in browser `localStorage`. | Standard for local demo offline fallback; production uses Supabase Auth tokens. |
| **INFO** | Console Security Notices | Security notices (`console.warn`) inform developers in local console when unauthorized access attempts are blocked. | Helpful for audit and debugging; sanitized without leaking PII. |

---

## Hackathon Release Verdict: **READY**
- No release blockers exist.
- Patient data isolation and RLS policies are active and verified.
- Camera video is strictly ephemeral (never saved).
- Private LLM keys are restricted to the server environment.
- Assistant endpoint is rate-limited and hardened against prompt injections and oversized payloads.

