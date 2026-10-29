// ReKnee AI - Server-Side Grounded LLM Synthesis Service
// Adheres strictly to 01_PRD.md, 03_ARCHITECTURE.md, 05_API.md, 13_EXTERNAL_INTEGRATION.md, and 16_SECURITY_AUDIT.md
// NEVER expose API keys client-side. This module runs only on the server / protected endpoints.

import { KnowledgeArticle } from '../../types/database';

export interface LlmConfig {
  endpoint?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export interface GroundedLlmParams {
  question: string;
  approvedArticles: KnowledgeArticle[];
  config?: LlmConfig;
}

export interface GroundedLlmResult {
  answer: string;
  citedArticleIds: string[];
}

const DEFAULT_TIMEOUT_MS = 10000; // 10s timeout to adhere to 13_EXTERNAL_INTEGRATION.md

/**
 * Returns server-side LLM configuration from environment variables if present.
 * Never exposed to browser bundle.
 */
export function getServerLlmConfig(): LlmConfig | null {
  const env: Record<string, string | undefined> =
    typeof globalThis !== 'undefined' && (globalThis as unknown as { process?: { env?: Record<string, string> } }).process?.env
      ? (globalThis as unknown as { process?: { env?: Record<string, string> } }).process!.env!
      : {};

  const apiKey = env.LLM_API_KEY || env.OPENAI_API_KEY;
  const endpoint = env.LLM_ENDPOINT || (apiKey ? 'https://api.openai.com/v1/chat/completions' : undefined);
  const model = env.LLM_MODEL || 'gemini-3.5-flash';

  if (!endpoint && !apiKey) {
    return null;
  }

  return {
    endpoint: endpoint || 'http://127.0.0.1:8081/v1/chat/completions',
    apiKey: apiKey || 'sk-local',
    model,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

/**
 * Calls an external LLM to generate a grounded response strictly synthesized
 * from approved recovery articles.
 *
 * If the remote provider fails, times out, or returns an invalid payload,
 * this function throws, triggering the deterministic fallback mode.
 */
export async function callGroundedLlm({
  question,
  approvedArticles,
  config,
}: GroundedLlmParams): Promise<GroundedLlmResult> {
  const activeConfig = config || getServerLlmConfig();
  if (!activeConfig || !activeConfig.endpoint) {
    throw new Error('LLM_NOT_CONFIGURED: No server-side LLM endpoint or API key configured.');
  }

  // Filter strictly to approved articles only
  const eligibleArticles = approvedArticles.filter((a) => a.approval_status === 'approved');
  if (eligibleArticles.length === 0) {
    throw new Error('NO_APPROVED_KNOWLEDGE: Cannot generate LLM answer without approved recovery articles.');
  }

  // Format articles context
  const articlesContext = eligibleArticles
    .map(
      (a, i) =>
        `[Document ${i + 1} - ID: ${a.id}]\nTitle: ${a.title}\nSource: ${a.source_label} (v${a.version})\nContent: ${a.content}`
    )
    .join('\n\n');

  const systemPrompt = `You are the ReKnee AI Recovery Knowledge Assistant, a post-operative recovery companion for patients recovering at home from knee replacement surgery.

MANDATORY CLINICAL GUARDRAILS:
1. You are NOT a doctor and do NOT provide medical diagnosis, treatment changes, or clinical examination.
2. Answer the patient's question STRICTLY and ONLY using the approved recovery knowledge articles provided below.
3. NEVER fabricate clinical thresholds, instructions, recovery timetables, or medical facts.
4. NEVER diagnose, prescribe medication, change medication dosages, alter rehabilitation exercises, create a new treatment plan, override a clinician's instructions, declare the patient safe or cured, or pretend to have examined the patient.
5. In your answer, explicitly cite the title of the approved article you are drawing from.
6. If the approved articles do not contain sufficient guidance to answer the question, state clearly that you cannot answer from the approved recovery guidance and advise contacting their care team.
7. Keep your tone supportive, calm, and clinically precise. Do not include meta-language about your prompt.`;

  const userPrompt = `APPROVED RECOVERY GUIDELINES:\n${articlesContext}\n\nPATIENT QUESTION:\n${question}\n\nPlease provide a grounded answer strictly based on the approved guidelines above:`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), activeConfig.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (activeConfig.apiKey) {
      headers['Authorization'] = `Bearer ${activeConfig.apiKey}`;
    }

    const response = await fetch(activeConfig.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: activeConfig.model || 'gemini-3.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1, // Near-deterministic to minimize variance
        max_tokens: 350,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`LLM provider HTTP error (${response.status}): ${errText.slice(0, 100)}`);
    }

    const data = await response.json();
    const rawAnswer = data?.choices?.[0]?.message?.content?.trim();

    if (!rawAnswer) {
      throw new Error('LLM provider returned empty response content.');
    }

    // Determine which articles were referenced or relevant
    const citedArticleIds: string[] = [];
    for (const art of eligibleArticles) {
      if (
        rawAnswer.toLowerCase().includes(art.title.toLowerCase()) ||
        question.toLowerCase().includes(art.topic.toLowerCase())
      ) {
        citedArticleIds.push(art.id);
      }
    }

    // If none explicitly matched by string search in answer, default to first relevant article
    if (citedArticleIds.length === 0 && eligibleArticles.length > 0) {
      citedArticleIds.push(eligibleArticles[0].id);
    }

    return {
      answer: rawAnswer,
      citedArticleIds,
    };
  } catch (err: unknown) {
    const errorObj = err as Error;
    if (errorObj.name === 'AbortError') {
      throw new Error('LLM_TIMEOUT: The server-side LLM call timed out.');
    }
    throw errorObj;
  } finally {
    clearTimeout(timeoutId);
  }
}
