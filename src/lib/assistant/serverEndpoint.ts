// ReKnee AI - Server-Side Assistant Endpoint Handler
// Adheres strictly to 01_PRD.md, 03_ARCHITECTURE.md, 04_DATABASE.md, 05_API.md, 13_EXTERNAL_INTEGRATION.md, and 16_SECURITY_AUDIT.md
// NEVER expose private LLM API keys in client-side code.

import { KnowledgeArticle } from '../../types/database';
import { repository } from '../supabase/repository';
import { answerRecoveryQuestion } from './retrieval';
import { getServerLlmConfig, callGroundedLlm, LlmConfig } from './llmService';
import { AssistantApiRequest, AssistantApiResponse, AssistantApiError } from './types';

// Rate Limiting Storage: sliding window map (key: string -> timestamp[])
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 12;
const MAX_TRACKED_CLIENTS = 1000;

// Prompt injection & safety bypass patterns (16_SECURITY_AUDIT.md)
const PROMPT_INJECTION_PATTERNS = [
  /ignore (all )?previous instructions/i,
  /ignore (your )?rules/i,
  /disregard previous instructions/i,
  /you are now (an? )?unrestricted/i,
  /act as (an? )?unrestricted/i,
  /act as a (medical )?doctor/i,
  /dan mode/i,
  /jailbreak/i,
  /system prompt override/i,
  /bypass (safety|clinical) (rules|guidelines)/i,
  /pretend you are my (doctor|physician|surgeon)/i,
  /override safety protocol/i,
];

/**
 * Resets rate limit records (used in tests and maintenance)
 */
export function resetRateLimits(): void {
  rateLimitMap.clear();
}

/**
 * Prunes expired entries from rateLimitMap to prevent unbounded memory growth
 */
function pruneRateLimits(now: number): void {
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, valid);
    }
  }
}

/**
 * Validates request rate limit for a client identifier (patient ID or IP)
 */
export function checkRateLimit(clientId: string): boolean {
  const now = Date.now();

  // Guard against unbounded memory consumption by pruning when map exceeds threshold
  if (rateLimitMap.size > MAX_TRACKED_CLIENTS) {
    pruneRateLimits(now);
  }

  const timestamps = rateLimitMap.get(clientId) || [];

  // Filter timestamps within current window
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    return false; // Rate limited
  }

  recent.push(now);
  rateLimitMap.set(clientId, recent);
  return true;
}

/**
 * Validates input against prompt injection attempts
 */
export function containsPromptInjection(text: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Main server-side endpoint handler for POST /api/assistant
 * Can be invoked by Vite dev server middleware, serverless functions, or direct unit tests.
 *
 * @param payload The incoming JSON payload
 * @param clientIdentifier Client IP or fallback identifier for rate limiting
 * @param overrideLlmConfig Optional test-time LLM config injection
 */
export async function handleAssistantRequest(
  payload: unknown,
  clientIdentifier: string = 'demo-client',
  overrideLlmConfig?: LlmConfig | null
): Promise<{ status: number; body: AssistantApiResponse | AssistantApiError }> {
  // 1. Validate payload structure (05_API.md)
  if (!payload || typeof payload !== 'object') {
    return {
      status: 400,
      body: {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Malformed request: payload must be a JSON object.',
        },
      },
    };
  }

  const req = payload as Partial<AssistantApiRequest>;

  // 2. Validate question input
  if (!req.question || typeof req.question !== 'string' || req.question.trim().length === 0) {
    return {
      status: 400,
      body: {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing or empty question. Please provide a recovery question.',
        },
      },
    };
  }

  const cleanQuestion = req.question.trim();

  // Bounded input security (16_SECURITY_AUDIT.md)
  if (cleanQuestion.length > 500) {
    return {
      status: 400,
      body: {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Question exceeds maximum allowed length of 500 characters.',
        },
      },
    };
  }

  // 3. Abuse & Rate limit check (05_API.md, 16_SECURITY_AUDIT.md)
  const rateLimitKey = req.patientId || clientIdentifier;
  if (!checkRateLimit(rateLimitKey)) {
    return {
      status: 429,
      body: {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait a minute before submitting another question.',
        },
      },
    };
  }

  // 4. Prompt injection & safety bypass defense
  if (containsPromptInjection(cleanQuestion)) {
    return {
      status: 400,
      body: {
        error: {
          code: 'PROMPT_INJECTION_BLOCKED',
          message:
            'Security Warning: Instructions attempting to bypass clinical safety boundaries or override clinical protocols are blocked.',
        },
      },
    };
  }

  // 5. Patient Authorization Check (if patientId supplied)
  if (req.patientId) {
    if (typeof req.patientId !== 'string' || req.patientId.length > 128) {
      return {
        status: 400,
        body: {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid patientId identifier format.',
          },
        },
      };
    }
    const current = repository.getCurrentProfile();
    if (current && current.role === 'patient' && current.id !== req.patientId) {
      return {
        status: 403,
        body: {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Unauthorized: Patients may only ask questions for their own profile.',
          },
        },
      };
    }
  }

  // 6. Retrieve approved knowledge articles from persistence
  let approvedArticles: KnowledgeArticle[];
  try {
    approvedArticles = await repository.getApprovedKnowledgeArticles();
  } catch (dbErr) {
    console.error('Database query error fetching approved articles:', dbErr);
    return {
      status: 500,
      body: {
        error: {
          code: 'DATABASE_ERROR',
          message: 'Unable to access approved recovery knowledge base. Please try again.',
        },
      },
    };
  }

  // Filter to ensure only articles with approved status are accessible
  const strictlyApproved = approvedArticles.filter((a) => a.approval_status === 'approved');

  // 7. Grounded Guardrails & Retrieval Evaluation
  const evaluated = answerRecoveryQuestion(cleanQuestion, strictlyApproved);

  // If guardrail triggered (emergency, medication, diagnosis refusal, treatment refusal, or no knowledge match)
  // We return the deterministic safe response directly without querying an LLM
  if (evaluated.status !== 'answered') {
    return {
      status: 200,
      body: {
        answer: evaluated.answer,
        sourceArticleIds: evaluated.sourceArticles.map((a) => a.id),
        sourceArticles: evaluated.sourceArticles,
        status: evaluated.status,
      },
    };
  }

  // 8. Grounded LLM Answering with Resilient Deterministic Fallback
  // Check if an LLM is configured on the server
  const llmConfig = overrideLlmConfig !== undefined ? overrideLlmConfig : getServerLlmConfig();

  let finalAnswer = evaluated.answer;
  let finalSourceArticles = evaluated.sourceArticles;

  if (llmConfig && llmConfig.endpoint) {
    try {
      // Call server-side LLM with strictly grounded prompt & approved articles context
      const llmResult = await callGroundedLlm({
        question: cleanQuestion,
        approvedArticles: strictlyApproved,
        config: llmConfig,
      });

      finalAnswer = llmResult.answer;

      // Ensure citations are mapped
      if (llmResult.citedArticleIds && llmResult.citedArticleIds.length > 0) {
        const cited = strictlyApproved.filter((a) => llmResult.citedArticleIds.includes(a.id));
        if (cited.length > 0) {
          finalSourceArticles = cited;
        }
      }
    } catch (llmErr) {
      // LLM Failure: Per 13_EXTERNAL_INTEGRATION.md and 05_API.md,
      // fallback to deterministic knowledge-search synthesis from approved articles
      console.warn('Server LLM call failed or timed out, utilizing deterministic extraction fallback:', llmErr);
      finalAnswer = evaluated.answer;
      finalSourceArticles = evaluated.sourceArticles;
    }
  }

  // 9. Construct safe, grounded API response
  const response: AssistantApiResponse = {
    answer: finalAnswer,
    sourceArticleIds: finalSourceArticles.map((a) => a.id),
    sourceArticles: finalSourceArticles,
    status: evaluated.status,
  };

  return {
    status: 200,
    body: response,
  };
}
