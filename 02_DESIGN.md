# ReKnee AI — Design System

## Design Goal
Create a calm, trustworthy healthcare product that feels supportive rather than clinical or alarmist. Avoid generic AI SaaS gradients, excessive glassmorphism, decorative dashboards, and unnecessary animation.

## Visual Direction
- Warm off-white page background.
- Deep navy primary text.
- Restrained teal accent for primary actions and positive progress.
- Neutral borders and surfaces.
- Rounded but not overly pill-shaped cards.
- Large readable typography.
- Strong hierarchy and generous whitespace.
- Use icons from Lucide consistently.

## Colors
- Background: warm off-white.
- Surface: white.
- Primary text: deep navy.
- Secondary text: muted slate.
- Accent: calm teal.
- Success: restrained green.
- Warning: amber.
- Error/urgent: red.
Use semantic color names in the code rather than scattering raw values.

## Typography
- System sans-serif stack for reliability.
- H1: strong, compact, mobile-friendly.
- H2/H3: clear section hierarchy.
- Body: 16px baseline on mobile where practical.
- Captions/helper text: never below accessible readability.

## Spacing
Use a consistent 4px base scale with common values 4, 8, 12, 16, 24, 32, 40, 48.

## Layout
- Mobile-first.
- Main content max width approximately 1200px on desktop.
- Patient mobile content should remain comfortable for one-handed use.
- Primary action should be visually obvious without dominating the screen.
- Clinician dashboard may use a wider two-column layout.

## Components
Required reusable components:
- AppShell
- BottomNavigation
- PageHeader
- Card
- Button
- IconButton
- Badge
- ProgressBar
- MetricCard
- FormField
- Slider/Scale
- Checkbox
- EmptyState
- ErrorState
- LoadingSkeleton
- AlertCard
- SourceCitation
- Modal/Drawer
- Toast
- SessionSummary

## Navigation
Patient bottom navigation:
Home / Exercise / Check-in / Assistant / Progress.

Clinician navigation:
Overview / Patients / Alerts.

Keep role-specific navigation separate.

## Forms
- Explicit labels.
- Helpful validation.
- Do not rely on placeholder text as a label.
- Inline errors near fields.
- Disable submit only when there is a clear reason.
- Preserve entered data after recoverable failures.

## Loading
Use skeletons for page-level data and small spinners only for short actions. Never leave a blank screen while data loads.

## Empty
Explain what is missing and provide one useful next action. Avoid generic “No data” messages.

## Error
Explain what failed in human language. Provide Retry where safe. Never expose stack traces or secrets.

## Interactions
- Small transitions for navigation and state changes.
- Avoid animation around urgent warnings.
- Camera controls should respond immediately.
- Confirmation should be subtle and non-blocking when possible.

## Responsive Behavior
- Mobile: stacked cards, bottom nav, full-width primary actions.
- Tablet: two-column content where useful.
- Desktop: wider clinician dashboard, fixed side navigation may be used.
- Camera preview must preserve aspect ratio and not push critical controls below the fold unnecessarily.

## Accessibility
- Keyboard navigation.
- Visible focus.
- Minimum practical touch target around 44px.
- Semantic HTML.
- Accessible labels for camera controls.
- Do not use color alone for alerts.
- Respect reduced-motion preferences.
- Charts need text alternatives or summary values.
- Error messages associated with inputs.

## Page Guidance
### Patient Home
Today's plan first, then progress, check-in reminder, assistant entry point.

### Exercise
Instructions → camera → live status → controls → summary.

### Check-in
Pain scale → symptoms → notes → submit → confirmation.

### Assistant
Conversation → source references → suggested questions → escalation/contact action.

### Progress
Simple trends and completed-session history.

### Clinician
Alert queue and patient status first; details second.

## Safety UX
Urgent messaging must be visually clear without implying a diagnosis. Use explicit language such as “seek urgent medical care” where appropriate and approved.
