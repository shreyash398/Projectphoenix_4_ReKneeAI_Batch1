# ReKnee AI — Final Production Audit

## Launch Verdict
Choose one:
- READY
- READY WITH WARNINGS
- NOT READY

Do not mark READY without evidence.

## 1. Product
- [ ] PRD requirements implemented.
- [ ] Core patient journey works.
- [ ] Clinician journey works.
- [ ] MVP scope respected.
- [ ] Out-of-scope features have not created unnecessary risk.

## 2. UX
- [ ] Mobile layout works.
- [ ] Navigation is consistent.
- [ ] Forms validate.
- [ ] Loading states exist.
- [ ] Empty states exist.
- [ ] Error states exist.
- [ ] Accessibility basics verified.

## 3. Exercise
- [ ] Camera starts only after user action.
- [ ] Permission denial handled.
- [ ] Landmarks display when available.
- [ ] Session controls work.
- [ ] Camera tracks are released.
- [ ] No raw video is persisted.
- [ ] Prototype limitations are visible.
- [ ] Fallback is clearly labelled.

## 4. Assistant
- [ ] Only approved knowledge is retrieved.
- [ ] Answers show sources.
- [ ] Unsupported questions do not generate fabricated answers.
- [ ] Provider failures have fallback.
- [ ] API keys remain server-side.
- [ ] No diagnosis/treatment claims.

## 5. Alerts
- [ ] Rules are deterministic.
- [ ] Demonstration thresholds are labelled.
- [ ] Clinical alerts and engagement reminders are separate.
- [ ] Alert source/reason/time are shown.
- [ ] Authorized clinician can review.
- [ ] Audit action is recorded.
- [ ] Duplicate alerts are controlled.

## 6. Security
- [ ] RLS enabled.
- [ ] Patient ownership enforced.
- [ ] Clinician access relationship enforced.
- [ ] No secrets in repository.
- [ ] No service-role key in frontend.
- [ ] Input validation implemented.
- [ ] Sensitive logging minimized.

## 7. Data
- [ ] Migrations applied.
- [ ] Seed data synthetic.
- [ ] Refresh persistence verified.
- [ ] No raw video storage.
- [ ] Backup strategy documented.

## 8. Testing
- [ ] Unit tests.
- [ ] Integration tests.
- [ ] Core E2E journey.
- [ ] Unauthorized-access tests.
- [ ] Mobile camera test.
- [ ] Production build test.

## 9. Deployment
- [ ] HTTPS.
- [ ] Environment variables configured.
- [ ] Supabase production settings checked.
- [ ] Deployment URL verified.
- [ ] Rollback/recovery plan understood.

## 10. Hackathon Demo
The final demo should show:
1. patient home;
2. camera-assisted exercise;
3. saved session;
4. symptom check-in;
5. grounded assistant answer;
6. transparent alert;
7. clinician review.

## Final Decision
### READY
All critical items verified.

### READY WITH WARNINGS
Core journey works, but documented non-blocking limitations remain.

### NOT READY
Any critical security, data integrity, authorization, deployment, or core-journey failure remains.

## Mandatory Manual Approval
Clinical content, exercise configuration, symptom escalation rules, and any claim of clinical effectiveness require qualified clinical review before real-world deployment.
