# ReKnee AI — Deployment & Production Setup

## Target
Deploy the Vite React application to Vercel over HTTPS with Supabase backend.

## Build
Run:
- install dependencies;
- type-check;
- lint;
- production build;
- preview/smoke test.

## Environment
Frontend:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server:
- optional `LLM_API_KEY`

Never commit values.

## Supabase
- apply migrations;
- seed only synthetic/demo data;
- verify RLS;
- configure allowed production URL if required;
- verify authentication redirects.

## Vercel
- connect repository;
- configure build command;
- configure environment variables;
- deploy;
- verify HTTPS.

## Camera
Camera testing requires a secure context such as HTTPS in the deployed app. Test permissions on an actual phone.

## Production Safety
Do not use development service-role credentials in the browser.
Do not destroy existing data.
Verify migration state before deployment.

## Acceptance
- production build succeeds;
- site loads;
- login/session works;
- patient flow works;
- clinician flow works;
- database persists;
- camera permission works;
- assistant fallback works;
- alerts work.
