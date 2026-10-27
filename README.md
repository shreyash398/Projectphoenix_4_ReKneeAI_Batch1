# ReKnee AI

**The Connected Recovery Companion**

ReKnee AI is a mobile-first web application that supports patients recovering at home after knee replacement surgery. It bridges the gap between hospital discharge and follow-up visits by providing structured recovery guidance, exercise tracking, symptom monitoring, and real-time clinician oversight — all in one place.

---

## Problem

After discharge, patients often struggle to follow prescribed exercises, remember post-operative instructions, and communicate concerns between visits. Clinicians have limited visibility into what happens at home during the critical recovery window.

## Solution

ReKnee AI makes the weeks after discharge more structured by:

- Presenting approved recovery guidance in a single, clear interface
- Helping patients document exercise sessions using camera-assisted pose detection
- Recording daily symptom check-ins with structured pain and mobility tracking
- Answering recovery questions from a clinician-approved knowledge base
- Surfacing configurable alerts to authorized clinicians for timely review
- Providing doctor-verified recovery completion certificates

> **Important:** ReKnee AI does not diagnose, prescribe, replace a clinician, or guarantee exercise correctness. Clinical content and thresholds are illustrative until reviewed by a qualified professional.

---

## Features

### Patient Portal

| Feature | Description |
|---------|-------------|
| **Recovery Home** | Personalized dashboard showing today's plan, progress summary, and quick actions |
| **Exercise Coach** | Camera-assisted exercise session with MediaPipe pose landmark detection, rep counting, and real-time feedback |
| **Daily Check-in** | Structured symptom reporting — pain scale (0–10), swelling, stiffness, mobility, and free-text notes |
| **Progress History** | Visual recovery timeline with pain trends, session history, and milestone tracking via Recharts |
| **Knowledge Assistant** | Grounded Q&A from approved recovery content with source references and safe fallback for unsupported questions |
| **Verified Reports** | Doctor-verified recovery completion certificates with PDF generation and audit trail |

### Clinician Portal

| Feature | Description |
|---------|-------------|
| **Clinical Overview** | Triage dashboard with patient summary metrics, high-priority alert queue, pending verifications, and recent activity feed |
| **Patient Directory** | Searchable roster of authorized patients with recovery status, pain scores, and direct record access |
| **Patient Detail** | Complete patient record — recovery plan, exercise sessions, check-in history, pain trends, and alert timeline |
| **Alert Management** | Rule-based clinical alert queue with acknowledge, review, and follow-up actions — fully audited |
| **Verification Review** | Review and cryptographically sign patient recovery completion reports |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 · TypeScript · Vite |
| **Styling** | Tailwind CSS · Custom design tokens |
| **Icons** | Lucide React |
| **Charts** | Recharts |
| **Pose Detection** | MediaPipe Pose Landmarker (`@mediapipe/tasks-vision`) |
| **Backend** | Supabase (Auth + PostgreSQL + Row-Level Security) |
| **PDF Generation** | html2canvas + custom report builder |
| **Assistant** | Grounded retrieval + optional LLM synthesis |
| **Deployment** | Vercel (HTTPS required for camera access) |

---

## Architecture

```
Browser
  → React UI (pages, components, features)
  → Supabase Auth / PostgreSQL + RLS
  → Optional protected assistant endpoint
  → MediaPipe running locally in-browser
```

**Key principles:**
- Single web application, one managed backend — no unnecessary microservices
- Server-side authorization with Row-Level Security as the final boundary
- Clinician access requires an explicit patient-access relationship
- Camera frames stay on-device; only session metadata is persisted
- Modular feature boundaries with typed service layers

---

## Project Structure

```
src/
├── components/         # Shared UI components (layout, common)
├── pages/              # Route-level page components
├── features/           # Feature modules
│   ├── pose/           # MediaPipe pose detection & exercise logic
│   ├── assistant/      # Knowledge assistant service
│   ├── checkins/       # Symptom check-in service
│   ├── alerts/         # Alert engine & rule processing
│   └── progress/       # Progress tracking & visualization
├── lib/                # Core libraries
│   ├── supabase/       # Supabase client, repository, mock store
│   ├── alerts/         # Alert rule engine
│   ├── assistant/      # Knowledge base & retrieval
│   └── reports/        # PDF certificate generation
├── contexts/           # React context providers (Auth)
├── types/              # TypeScript type definitions
├── App.tsx             # Router & route configuration
└── main.tsx            # Application entry point
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/shreyash398/Projectphoenix_4_ReKneeAI_Batch1.git
cd Projectphoenix_4_ReKneeAI_Batch1

# Install dependencies
npm install
```

### Environment

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Required variables:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Optional (server-only):
```env
LLM_API_KEY=your_llm_api_key
```

> The app runs in offline local repository mode with synthetic data when Supabase credentials are not configured.

### Development

```bash
npm run dev          # Start development server (http://localhost:5173)
npm run build        # Production build (tsc + vite build)
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run test         # Run Vitest test suite (185 tests)
```

---

## Routes

| Path | Role | Page |
|------|------|------|
| `/` | Patient | Recovery Home |
| `/exercise` | Patient | Exercise Coach |
| `/check-in` | Patient | Daily Symptom Check-in |
| `/assistant` | Patient | Knowledge Assistant |
| `/progress` | Patient | Progress History |
| `/reports` | Patient | Verified Reports |
| `/clinician` | Clinician | Clinical Overview |
| `/clinician/patients` | Clinician | Patient Directory |
| `/clinician/patients/:id` | Clinician | Patient Detail |
| `/clinician/alerts` | Clinician | Alert Queue |
| `/clinician/alerts/:id` | Clinician | Alert Review |
| `/clinician/verifications` | Clinician | Verification Requests |

---

## Security & Authorization

- **Authentication:** Supabase Auth with role-based session management
- **Authorization:** PostgreSQL Row-Level Security (RLS) as the final enforcement boundary
- **Clinician access:** Requires an explicit `clinician_patient_access` relationship — no implicit access
- **Data isolation:** Patients can only access their own records
- **Audit trail:** All clinician actions (alert reviews, verification approvals) are immutably logged
- **Camera privacy:** Frames processed on-device via MediaPipe; no raw video is stored or transmitted
- **No secrets in frontend:** API keys and service-role credentials are never exposed to the browser

---

## Testing

The project includes a comprehensive test suite covering:

- **Authentication & authorization security** — role enforcement, RLS boundary testing, cross-patient isolation
- **Clinician dashboard** — metrics aggregation, patient roster, detail views, authorization checks
- **Alert engine** — rule-based alert generation, clinician acknowledgement, audit trails
- **Knowledge assistant** — grounded retrieval, LLM fallback, rate limiting, abuse protection
- **Verification reports** — lifecycle workflow, clinician approval, PDF generation, audit history
- **Exercise sessions** — session recording, pose detection integration
- **Symptom check-ins** — structured data capture, pain scale validation

```bash
npm run test
# 10 test files · 185 tests · all passing
```

---

## Contributors

| Name | Role |
|------|------|
| **Shreyash Kundalkar** | Project Lead & Full-Stack Development |
| **Soham Rane** | Frontend Development & UI/UX Design |
| **Ritesh Wagh** | Backend Development & Database Architecture |
| **Sarthak Kale** | Testing, QA & Documentation |

---

## License

This project was built as part of **Project Phoenix — Batch 1**. All rights reserved.

---

<p align="center">
  <strong>ReKnee AI</strong> — Structured recovery, connected care.
</p>
