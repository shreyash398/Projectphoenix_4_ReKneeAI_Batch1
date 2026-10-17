# ReKnee AI — Project Setup Instructions

## Objective
Create the production-ready foundation without implementing feature-specific behavior yet.

## Required Stack
- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React
- React Router
- Supabase client
- Recharts
- MediaPipe Tasks Vision when the exercise feature is implemented

## Initial Structure
```text
src/
  components/
  pages/
  features/
    pose/
    assistant/
    checkins/
    alerts/
    progress/
  lib/
    supabase/
    alerts/
    assistant/
  types/
  App.tsx
  main.tsx
supabase/
  migrations/
  seed/
public/
```

## Configuration
Required:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional server-only:
- `LLM_API_KEY`

Provide `.env.example` only. Never commit `.env`.

## Base Scripts
Expected:
- `dev`
- `build`
- `preview`
- `lint`
- `typecheck`
- `test`

## Setup Acceptance
- App starts.
- Routes render.
- Tailwind works.
- TypeScript passes.
- Lint passes.
- Build passes.
- No secrets are committed.
- Empty environment configuration does not produce an unexplained crash.

## Do Not Build Yet
- Full camera processing.
- Assistant provider.
- Alert engine.
- Complex database logic.
- Family portal.
- Multiple exercise types.
