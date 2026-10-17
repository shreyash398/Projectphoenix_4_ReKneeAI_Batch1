# ReKnee AI — Implementation Plan

## Phase 0 — Scope and Repository
**Goal:** establish the shared source of truth.
Tasks:
- Add project documents.
- Create Git repository.
- Configure branch strategy.
- Confirm environment variables.
Completion: project builds or has a clear initial setup task.

## Phase 1 — Project Foundation
- Initialize React/TypeScript/Vite.
- Tailwind and design tokens.
- Routing.
- App shell.
- Reusable components.
- Lint/type-check/build.
Tests: build and route smoke test.

## Phase 2 — Patient UI
- Home.
- Exercise page.
- Check-in.
- Assistant.
- Progress.
Use mock data initially.
Completion: complete clickable patient journey.

## Phase 3 — Backend
- Supabase project.
- Migrations.
- Seed data.
- RLS.
- Repositories/data access.
Tests: persistence and unauthorized access.

## Phase 4 — Authentication
- Patient/clinician authentication.
- Protected routes.
- Resource ownership.
Tests: login/logout/forbidden scenarios.

## Phase 5 — Knowledge Assistant
- Knowledge article schema.
- Approved-content retrieval.
- Assistant endpoint.
- Source citations.
- Deterministic fallback.
Tests: supported/unsupported/unauthorized/provider failure.

## Phase 6 — Exercise Coach
- MediaPipe setup.
- Camera permissions.
- Landmark overlay.
- Single-exercise state machine.
- Session persistence.
- Fallback.
Tests: permission denial, model failure, cleanup, phone test.

## Phase 7 — Alerts
- Rule engine.
- Clinical-review vs engagement categories.
- Alert persistence.
- Clinician review.
- Audit actions.
Tests: trigger/no-trigger/duplicate/review/access.

## Phase 8 — Integration
End-to-end:
plan → exercise → session → check-in → assistant → alert → clinician.

Completion: all records persist and appear consistently.

## Phase 9 — QA/Security
- Full test suite.
- RLS review.
- Secret scan.
- Accessibility.
- Mobile layout.
- Error states.
- Performance sanity checks.

## Phase 10 — Deployment
- Vercel HTTPS.
- Production Supabase environment.
- Migrations.
- Environment variables.
- Camera test on phone.
- Backup demo recording.

## Phase 11 — Demo Freeze
- Synthetic dataset reset.
- Freeze features.
- Rehearse 3-minute story.
- Prepare fallback.
- Document known limitations.

## Recommended First Task
Create the project repository and commit the six source-of-truth documents plus the implementation plan. Then initialize the React/Vite foundation.
