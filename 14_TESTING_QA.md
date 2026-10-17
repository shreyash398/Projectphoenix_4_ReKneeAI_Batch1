# ReKnee AI — Testing & QA Strategy

## Priority
Business-critical end-to-end behavior first.

## Unit Tests
- pain-score validation;
- alert rules;
- duplicate alert prevention;
- assistant retrieval filtering;
- exercise repetition state logic;
- permission/role helpers.

## Integration Tests
- create/read session;
- create/read check-in;
- authorized clinician access;
- unauthorized access;
- assistant source retrieval;
- alert creation/review.

## E2E Journey
1. Patient login.
2. View plan.
3. Start exercise.
4. End session.
5. Verify session.
6. Submit check-in.
7. Ask assistant.
8. Trigger demo alert.
9. Clinician login.
10. Review patient.
11. Review/close alert.

## Edge Cases
- empty plan;
- no sessions;
- no check-ins;
- camera permission denied;
- model fails;
- network unavailable;
- assistant has no answer;
- invalid pain;
- unauthorized patient ID;
- expired session.

## Manual Mobile QA
Test on a real HTTPS phone:
- camera permissions;
- portrait layout;
- camera framing;
- low-light behavior;
- pause/resume/stop;
- navigation away from camera;
- refresh after saved record.

## Release Gate
No critical security, data-loss, broken-core-flow, or unauthorized-access issues.
