# ReKnee AI — External Service Integration

## Required Services
### Supabase
Purpose: authentication, PostgreSQL persistence and RLS.

### MediaPipe Pose Landmarker
Purpose: browser-side pose landmarks for the single exercise prototype.

### Vercel
Purpose: HTTPS deployment.

### Optional LLM Provider
Purpose: grounded natural-language synthesis for approved recovery knowledge.

## Integration Rules
- Keep provider-specific code behind a service interface.
- Validate requests/responses.
- Set timeouts where server calls exist.
- Do not retry unsafe writes blindly.
- Never expose API keys client-side.
- Do not log patient notes or secrets.

## LLM Failure
Fallback to deterministic search/excerpts from approved knowledge. If no relevant source exists, say so.

## MediaPipe Failure
Show model-loading/error state and labelled demo fallback.

## Supabase Failure
Show retryable user-facing error and avoid pretending data was saved.

## Testing
For each provider test:
- success;
- timeout;
- invalid response;
- unavailable service;
- missing credentials;
- unauthorized access where applicable.
