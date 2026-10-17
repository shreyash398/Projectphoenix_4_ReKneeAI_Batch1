// ReKnee AI - Grounded Knowledge Retrieval & Answering Engine
// Strictly answers from clinician-approved knowledge articles with explicit citations

import { KnowledgeArticle, AssistantQuestionStatus } from '../../types/database';

export interface AssistantAnswer {
  answer: string;
  sourceArticles: KnowledgeArticle[];
  status: AssistantQuestionStatus;
}

// Emergency red-flag keywords
const EMERGENCY_KEYWORDS = [
  'chest pain',
  'heart attack',
  'short of breath',
  'difficulty breathing',
  'can’t breathe',
  'cant breathe',
  'passed out',
  'fainting',
  'coughing blood',
];

// Medication change request keywords
const MEDICATION_CHANGE_KEYWORDS = [
  'change my medicine',
  'change my medication',
  'stop taking my pills',
  'stop taking my medication',
  'increase dosage',
  'decrease dosage',
  'double my pain',
  'double my medication',
  'double my dose',
  'medication dosage',
  'pain medication dosage',
  'ibuprofen instead of',
  'substitute my med',
  'prescribe',
];

export function answerRecoveryQuestion(
  question: string,
  approvedArticles: KnowledgeArticle[]
): AssistantAnswer {
  const normalized = question.toLowerCase().trim();

  // 1. Red-Flag Emergency Screening
  if (EMERGENCY_KEYWORDS.some((kw) => normalized.includes(kw))) {
    const dvtArticle = approvedArticles.find((a) => a.topic === 'emergency_dvt');
    return {
      status: 'emergency_escalation',
      answer:
        'URGENT SAFETY NOTICE: The symptoms you described may require immediate medical attention. Do not wait for a message reply or a scheduled clinic visit. Please call your local emergency service (such as 911) or have someone take you to the nearest emergency department immediately.',
      sourceArticles: dvtArticle ? [dvtArticle] : [],
    };
  }

  // 2. Medication Alteration Guardrail
  if (MEDICATION_CHANGE_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return {
      status: 'unsupported_safe_fallback',
      answer:
        'Medication Safeguard: ReKnee AI cannot recommend, alter, or advise on prescribed prescription dosages or medication changes. Please contact your orthopedic surgical team or dispensing pharmacist directly to discuss any changes to your pain management medications.',
      sourceArticles: [],
    };
  }

  // 3. Grounded Retrieval across approved knowledge base
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 2);
  const scored = approvedArticles.map((article) => {
    let score = 0;
    const titleLower = article.title.toLowerCase();
    const contentLower = article.content.toLowerCase();
    const topicLower = article.topic.toLowerCase();

    for (const token of tokens) {
      if (titleLower.includes(token)) score += 5;
      if (topicLower.includes(token)) score += 4;
      if (contentLower.includes(token)) score += 1;
    }
    return { article, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const bestMatches = scored.filter((s) => s.score >= 3);

  if (bestMatches.length === 0) {
    return {
      status: 'unsupported_safe_fallback',
      answer:
        'I could not find an approved clinician instruction addressing your question in your post-operative recovery plan. For personalized guidance or if you are feeling unsure, please message your care team through the clinical portal or call your clinic.',
      sourceArticles: [],
    };
  }

  const primaryMatch = bestMatches[0].article;
  const matchedSources = bestMatches.slice(0, 2).map((m) => m.article);

  // Return grounded response synthesized from approved clinical guidance
  return {
    status: 'answered',
    answer: `Based on your approved recovery guidance ("${primaryMatch.title}"): ${primaryMatch.content}`,
    sourceArticles: matchedSources,
  };
}
