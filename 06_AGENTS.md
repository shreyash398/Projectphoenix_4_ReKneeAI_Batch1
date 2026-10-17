# ReKnee AI — Coding Agent Rules

## Source of Truth
Before making changes, read:
1. PRD.md
2. DESIGN.md
3. ARCHITECTURE.md
4. DATABASE.md
5. API.md

If a task conflicts with these documents, stop and ask rather than silently changing requirements.

## General Rules
- Inspect existing code before editing.
- Prefer small, focused changes.
- Reuse existing components and utilities.
- Do not rewrite working modules without a demonstrated reason.
- Do not introduce dependencies for problems already solved by the stack.
- Keep the application runnable after each change.

## Type Safety
- TypeScript strictness should be preserved.
- Avoid `any`.
- Define shared types for database/API boundaries.
- Validate external data at boundaries.

## Structure
Follow feature-oriented modules:
`features/pose`, `features/checkins`, `features/assistant`, `features/alerts`, etc.
Keep UI components reusable.

## Security
- Never commit secrets.
- Never expose private API keys.
- Never use Supabase service-role key in browser.
- Do not trust client-side roles.
- Respect RLS.
- Do not log sensitive health notes unnecessarily.

## Healthcare Safety
- Never add diagnosis logic.
- Never claim clinical validation.
- Never autonomously change prescribed treatment.
- Never declare a patient safe.
- Keep demonstration thresholds clearly labelled.
- Do not store raw camera video.

## Error Handling
Every async feature needs loading, success, empty and error behavior where relevant.

## Testing
Add tests for changed business logic. Prioritize:
- authorization;
- alert rules;
- assistant retrieval;
- validation;
- critical patient journey.

## Dependencies
Before adding a package, verify an existing dependency cannot solve the problem.

## Git Discipline
- One logical change per commit where practical.
- Do not modify unrelated files.
- Keep commit messages descriptive.
- Never commit `.env` or secrets.
- Use feature branches for parallel work.

## Documentation
Update relevant docs when architecture, API, database, or behavior materially changes.

## Final Report
After each task report:
- files changed;
- tests run;
- known limitations;
- manual verification required.
