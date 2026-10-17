# ReKnee AI — Debugging Procedure

## Principle
Find the root cause before changing code.

## Steps
1. Reproduce.
2. Capture exact error/log/browser behavior.
3. Identify affected layer: UI, state, API, database, provider, camera, auth.
4. Trace data flow.
5. Inspect recent changes.
6. Form a testable hypothesis.
7. Implement the smallest fix.
8. Run regression tests.
9. Verify related edge cases.

## Common ReKnee Failure Modes
### Camera
Check permissions, HTTPS, model asset path, video dimensions, frame loop cleanup.

### Supabase
Check environment variables, session, RLS policy, table names, column names, network status.

### Assistant
Check approved article retrieval, authorization filter, provider key, server-only boundary, fallback.

### Alerts
Check rule input normalization, duplicate prevention, source record, authorization.

### UI
Check route, async state, stale data, mobile overflow, disabled buttons.

## Never
- swallow exceptions;
- remove validation;
- disable RLS;
- expose secrets;
- fake a successful save;
- describe a fallback as real AI/camera analysis.
