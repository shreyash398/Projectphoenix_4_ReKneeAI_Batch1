// ReKnee AI - Frontend Assistant Client Service
// Calls server-side /api/assistant with resilient deterministic fallback
// Adheres to 01_PRD.md, 03_ARCHITECTURE.md, 05_API.md, and 16_SECURITY_AUDIT.md

import { AssistantApiResponse, AssistantApiError } from './types';
import { handleAssistantRequest } from './serverEndpoint';

/**
 * Sends a recovery question to the server-side assistant endpoint.
 * In a full deployment, this routes to /api/assistant (Vercel serverless / Node / Vite middleware).
 * If running purely in-browser without an HTTP server or during offline tests,
 * it falls back to the serverEndpoint logic with identical validation, rate limiting, and grounded retrieval.
 */
export async function askAssistantQuestion(
  question: string,
  patientId?: string
): Promise<AssistantApiResponse> {
  const cleanQ = question.trim();

  let httpAttempted = false;

  // Try calling the server-side HTTP /api/assistant endpoint if available
  try {
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question: cleanQ, patientId }),
    });

    httpAttempted = true;

    // Check if the response is JSON (not HTML fallback from an unconfigured SPA server)
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      if (res.ok) {
        const data: AssistantApiResponse = await res.json();
        return data;
      }

      // If server returned an error response (400, 403, 429, 500)
      const errorData: AssistantApiError = await res.json().catch(() => ({
        error: { code: 'INTERNAL_ERROR', message: 'Unable to process recovery question.' },
      }));
      throw new Error(errorData.error?.message || 'Server error occurred.');
    }
  } catch (err: unknown) {
    const errObj = err as Error;
    // If the server explicitly returned an error (e.g. 400 prompt injection, 429 rate limit, 403 unauthorized, 500 db error)
    if (httpAttempted && errObj?.message) {
      throw err;
    }
    // Otherwise it was a network failure connecting to /api/assistant (e.g. running in test runner or offline)
  }

  // Resilient direct handler fallback
  const directResult = await handleAssistantRequest(
    { question: cleanQ, patientId },
    patientId || 'client-local'
  );

  if (directResult.status >= 400) {
    const errorBody = directResult.body as AssistantApiError;
    throw new Error(errorBody.error.message);
  }

  return directResult.body as AssistantApiResponse;
}
