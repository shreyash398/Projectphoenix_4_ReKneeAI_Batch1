# ReKnee AI — Feature Development Procedure

## Task
For each approved feature, replace `[TASK / FEATURE]` with the exact feature requested.

## Required Process
1. Read PRD, DESIGN, ARCHITECTURE, DATABASE, API, AGENTS.
2. Inspect existing implementation.
3. Identify reusable components.
4. State the smallest implementation approach.
5. Implement the feature.
6. Add loading/empty/error/success states.
7. Validate user inputs.
8. Enforce authorization.
9. Update database/API only if required.
10. Add tests.
11. Run build/type-check/lint.

## Definition of Done
- User journey works.
- UI matches design system.
- No unnecessary dependency added.
- No unrelated files changed.
- Data persists where required.
- Errors are handled.
- Authorization is enforced.
- Tests pass.
- Documentation is updated if behavior changed.

## Blocking Ambiguity
Stop and ask if:
- requirement conflicts with PRD;
- security boundary is unclear;
- database change would be destructive;
- medical behavior requires clinical approval;
- an external service credential is missing.
