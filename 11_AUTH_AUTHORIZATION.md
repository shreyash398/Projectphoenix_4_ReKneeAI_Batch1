# ReKnee AI — Authentication & Authorization

## Provider
Supabase Auth.

## Roles
- patient
- clinician

## Authentication
Required for persisted patient/clinician data.

MVP can support:
- email/password or passwordless method supported by the chosen Supabase setup;
- logout;
- session restoration.

## Authorization
### Patient
Can access:
- own profile;
- own recovery plans;
- own sessions;
- own check-ins;
- own assistant history.

### Clinician
Can access only patients connected through `clinician_patient_access`.

### Knowledge
Patients can retrieve only approved knowledge available to their workflow.

### Alerts
Only authorized clinicians can review/modify clinical alerts.

## Protected Routes
Patient pages require patient session.
Clinician pages require clinician role plus backend authorization.

## Forbidden States
Show a safe 403-style page when authenticated but unauthorized.

## Session Security
Use Supabase-managed sessions. Do not manually store long-lived tokens in insecure browser storage.

## Tests
- login;
- logout;
- expired session;
- patient accessing another patient;
- clinician accessing authorized patient;
- clinician accessing unauthorized patient;
- unauthenticated route access.
