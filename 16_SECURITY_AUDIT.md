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
Critical / High / Medium / Low.

## Release Blockers
Any unauthorized patient data access, exposed secret, destructive data issue, or authentication bypass blocks release.
