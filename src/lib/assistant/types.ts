// ReKnee AI - Assistant API & Domain Types
// Strictly adhering to 01_PRD.md, 04_DATABASE.md, and 05_API.md

import { KnowledgeArticle, AssistantQuestionStatus } from '../../types/database';

export interface AssistantApiRequest {
  question: string;
  patientId?: string;
}

export interface AssistantApiResponse {
  answer: string;
  sourceArticleIds: string[];
  sourceArticles?: KnowledgeArticle[];
  status: AssistantQuestionStatus;
}

export interface AssistantApiError {
  error: {
    code:
      | 'INVALID_REQUEST'
      | 'RATE_LIMITED'
      | 'UNAUTHORIZED'
      | 'DATABASE_ERROR'
      | 'LLM_ERROR'
      | 'PROMPT_INJECTION_BLOCKED'
      | 'INTERNAL_ERROR';
    message: string;
  };
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  sourceArticles?: KnowledgeArticle[];
  status?: AssistantQuestionStatus;
  timestamp: string;
}
