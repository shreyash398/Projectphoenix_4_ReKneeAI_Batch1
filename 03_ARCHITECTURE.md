# ReKnee AI — Architecture

## Principles
- Simplest reliable architecture for hackathon MVP.
- One web application and one managed backend.
- Modular feature boundaries.
- Server-side authorization.
- No unnecessary microservices.
- Easy to replace demo components later.

## Stack
- React + TypeScript + Vite.
- Tailwind CSS.
- Lucide React.
- Supabase Auth + PostgreSQL + RLS.
- MediaPipe Pose Landmarker via `@mediapipe/tasks-vision`.
- Recharts for simple progress visualizations.
- Optional server-side LLM provider for grounded assistant.
- Vercel for HTTPS deployment.

## High-Level Architecture
Browser
→ React UI/features
→ Supabase Auth / database
→ optional protected assistant endpoint
→ MediaPipe running locally in browser.

Camera frames should remain on-device in MVP; only session metadata is persisted.

## Frontend Modules
- `pages/`
- `components/`
- `features/pose/`
- `features/checkins/`
- `features/assistant/`
- `features/alerts/`
- `features/progress/`
- `lib/supabase/`
- `lib/alerts/`
- `lib/assistant/`
- `types/`

## Data Flow
Patient action → typed feature service → Supabase query/mutation → RLS → database → UI state.

Exercise:
camera → pose model → landmark/state logic → session summary → persistence.

Assistant:
question → authorized retrieval → approved knowledge → optional LLM synthesis → source references → UI.

Alerts:
check-in/session event → deterministic rule engine → alert record → clinician review.

## Authentication
Supabase Auth. Browser receives a user session. Database RLS is the final authorization boundary.

## Authorization
Role and resource ownership must be checked server/database side. Clinician access requires an explicit patient-access relationship.

## API Architecture
Prefer direct Supabase queries for standard CRUD where RLS is sufficient. Use server-side functions/endpoints only for:
- privileged integrations;
- LLM provider calls;
- operations requiring secret credentials;
- carefully controlled server-side workflows.

## AI Architecture
The assistant is retrieval-grounded. Knowledge articles must be approved before they are eligible for answers.

Pipeline:
question → retrieve authorized approved content → construct constrained prompt → model response → validate source presence → return answer + sources.

Fallback:
keyword/topic retrieval and concise source excerpt when no LLM is configured.

## Environment
Frontend public configuration:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server-only:
- LLM provider key if used.
Never expose service-role keys or private provider keys.

## Error Handling
Typed feature errors where practical. UI receives safe user-facing messages. Logs should avoid sensitive data.

## Security Boundaries
- RLS on all patient-related tables.
- No service-role key in browser.
- No raw video storage.
- No secrets in Git.
- Server-side validation for protected operations.
- Approved knowledge only for assistant retrieval.
- Synthetic data for hackathon.

## Testing
Unit: alert rules, pose state logic, validation.
Integration: Supabase repositories, assistant retrieval, alert creation.
E2E: core patient-to-clinician journey.
Manual mobile: camera permissions, layout, HTTPS.

## Deployment
Build with Vite and deploy to Vercel. Configure environment variables. Apply Supabase migrations before enabling live mode.

## Future Scalability
Only after MVP validation:
- stronger clinician identity/access management;
- richer exercise library;
- robust retrieval/vector search;
- observability platform;
- formal clinical validation;
- enterprise integration.

These are not MVP requirements.
