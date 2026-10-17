# ReKnee AI — Database & Backend Connection

## Goal
Connect Supabase securely and implement the approved schema.

## Required Work
1. Create Supabase project.
2. Configure environment variables.
3. Apply versioned migrations.
4. Create seed/demo data.
5. Enable RLS.
6. Create data access functions.
7. Connect patient home, sessions, check-ins, assistant and clinician views.
8. Implement alert persistence.
9. Verify refresh persistence.
10. Test unauthorized access.

## Critical Security
- Browser uses only publishable/anon key.
- Never expose service-role key.
- RLS is mandatory.
- Clinician access requires explicit relationship.
- Patients cannot query another patient's records.
- Demo role switch must not bypass production authorization.

## Verification
Test:
- authenticated patient own records;
- patient attempting another patient ID;
- authorized clinician;
- unauthorized clinician;
- unauthenticated request;
- invalid input;
- database unavailable;
- duplicate alert/session handling where applicable.

## Migration Rule
Never rewrite applied production migrations. Add new migrations for changes.
