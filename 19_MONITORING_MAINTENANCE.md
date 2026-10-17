# ReKnee AI — Monitoring & Maintenance

## MVP Monitoring Philosophy
Use simple, actionable observability. Avoid collecting unnecessary patient information.

## Track
- application errors;
- failed API requests;
- database failures;
- authentication failures;
- assistant provider failures;
- alert creation failures;
- deployment/build failures;
- uptime.

## Do Not Log
- passwords;
- auth tokens;
- API keys;
- full symptom notes;
- raw camera frames;
- unnecessary personal health information.

## Critical Alerts
- production application unavailable;
- database unavailable;
- repeated authentication failures;
- assistant endpoint repeatedly failing;
- failed alert persistence.

## Backups
Use managed Supabase backup features appropriate to the selected plan. Document how to restore before handling real data.

## Maintenance
- dependency updates;
- security advisories;
- database migration review;
- RLS review;
- error-log review;
- backup verification.

## Future
Formal observability tooling can be added after MVP validation. Avoid building a complex monitoring stack for the hackathon.
