# ReKnee AI — API Specification

## API Strategy
Use Supabase client APIs for standard authorized CRUD protected by RLS. Use server-side endpoints/functions only where secrets or controlled business logic are required.

## Authentication
Supabase Auth session. Protected operations require an authenticated user. Database RLS remains authoritative.

## Core Operations

### Recovery Plans
`GET /rest/v1/recovery_plans?patient_id=eq.{id}`
Purpose: retrieve authorized recovery plans.

### Plan Exercises
`GET /rest/v1/plan_exercises?plan_id=eq.{id}`
Purpose: retrieve exercises for an authorized plan.

### Exercise Sessions
`POST /rest/v1/exercise_sessions`
Purpose: save session metadata.

Expected fields:
- plan exercise ID
- start/end time
- duration
- repetitions
- status
- measurement mode

### Check-ins
`POST /rest/v1/symptom_checkins`
Purpose: save daily symptom check-in.

Validation:
- pain integer 0–10;
- allowed symptom keys;
- note length limit;
- authenticated patient must match record owner.

### Progress
`GET /rest/v1/exercise_sessions?...`
`GET /rest/v1/symptom_checkins?...`

Use bounded pagination for history.

### Clinician Patients
`GET /rest/v1/clinician_patient_access?...`
Only authorized clinician relationships.

### Alerts
`GET /rest/v1/alerts?...`
`PATCH /rest/v1/alerts?id=eq.{id}`
Review mutations must verify clinician authorization.

### Alert Actions
`POST /rest/v1/alert_actions`
Records reviewer action and timestamp.

## Assistant Endpoint
If an LLM is used, use a protected server-side route such as:
`POST /api/assistant`

Request:
```json
{"question":"string"}
```

Response:
```json
{
  "answer":"string",
  "sourceArticleIds":["uuid"],
  "status":"answered"
}
```

The server must retrieve only authorized approved knowledge.

## Validation
Reject malformed IDs, missing required fields, oversized text, unsupported status values, and unauthorized resource IDs.

## Error Convention
Return:
```json
{
  "error": {
    "code": "SAFE_MACHINE_CODE",
    "message": "Human-readable safe message"
  }
}
```

Do not return stack traces, secrets, SQL details, or provider credentials.

## Pagination
Use cursor or bounded page-size patterns for clinician history. MVP can use `limit` + ordered timestamps if dataset size is small.

## External Integrations
- MediaPipe runs client-side and does not require a remote API.
- Supabase is the primary backend.
- Optional LLM provider is server-side only.
- Vercel hosts the web app.

## Webhooks
No webhook is required for MVP. If added later, verify provider signatures before processing.

## Rate Limiting
Assistant endpoint should have basic per-user/IP limits if exposed publicly. Supabase APIs should rely on platform protections plus application-level constraints.

## Environment Variables
Client:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server only:
- `LLM_API_KEY` if applicable.

Never expose:
- Supabase service-role key
- private LLM keys
- database passwords

## Failure Handling
- Supabase unavailable → show retryable error.
- LLM unavailable → deterministic knowledge-search fallback.
- Camera unavailable → labelled demo/manual fallback.
- Knowledge retrieval empty → do not invent an answer.
