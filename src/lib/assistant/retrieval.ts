// ReKnee AI - Grounded Knowledge Retrieval & Answering Engine
// Strictly answers from clinician-approved knowledge articles with explicit citations
// Never diagnoses, prescribes, alters treatment, or fabricates clinical guidance
// Adheres strictly to 01_PRD.md, 03_ARCHITECTURE.md, 04_DATABASE.md, and 05_API.md

import { KnowledgeArticle, AssistantQuestionStatus } from '../../types/database';

export interface AssistantAnswer {
  answer: string;
  sourceArticles: KnowledgeArticle[];
  status: AssistantQuestionStatus;
}

// Emergency red-flag keywords requiring immediate escalation
const EMERGENCY_KEYWORDS = [
  'chest pain',
  'heart attack',
  'short of breath',
  'shortness of breath',
  'difficulty breathing',
  'can’t breathe',
  'cant breathe',
  'passed out',
  'fainting',
  'coughing blood',
  'severe calf pain',
  'severe calf tenderness',
  'swollen and tender calf',
  'blood clot',
  'pulmonary embolism',
];

// Medication change request & prescribing keywords
const MEDICATION_KEYWORDS = [
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
  'prescribe me',
  'prescription for',
  'what drug should i take',
  'what medication should i take',
];

// Diagnostic query & physical examination keywords
const DIAGNOSIS_KEYWORDS = [
  'diagnose me',
  'diagnose my',
  'what disease do i have',
  'what illness do i have',
  'do i have an infection',
  'is my knee infected',
  'do i have a blood clot',
  'do i have dvt',
  'is it a tear',
  'examine my knee',
  'look at my knee',
  'check my wound for infection',
  'tell me what is wrong with my knee',
];

// Treatment override, exercise alteration, & safety declaration keywords
const TREATMENT_OVERRIDE_KEYWORDS = [
  'change my exercises',
  'change my exercise routine',
  'give me a new workout',
  'give me different exercises',
  'create a new treatment plan',
  'make me a treatment plan',
  'override my doctor',
  'override my surgeon',
  'override my physical therapist',
  'ignore my doctor',
  'am i completely healed',
  'am i cured',
  'tell me i am safe',
  'declare me safe',
  'is it safe to stop using my walker',
  'is it safe to walk without crutches',
  'what degree flexion is 100% safe',
  'invent a threshold',
];

/**
 * Evaluates a patient question against clinical guardrails and approved knowledge articles.
 * Returns a grounded answer with explicit citations, or safe refusal.
 */
export function answerRecoveryQuestion(
  question: string,
  approvedArticles: KnowledgeArticle[]
): AssistantAnswer {
  const normalized = question.toLowerCase().trim();

  // Filter to ensure ONLY approved articles are ever eligible for retrieval
  const eligibleArticles = approvedArticles.filter(
    (a) => a.approval_status === 'approved'
  );

  // 1. Red-Flag Emergency Screening (Chest pain, shortness of breath, severe calf pain)
  if (EMERGENCY_KEYWORDS.some((kw) => normalized.includes(kw))) {
    const emergencyArticle = eligibleArticles.find((a) => a.topic === 'emergency_dvt');
    return {
      status: 'emergency_escalation',
      answer:
        'URGENT SAFETY NOTICE: The symptoms you described may require immediate medical attention. Do not wait for a message reply or a scheduled clinic visit. Please call your local emergency service (such as 911) or have someone take you to the nearest emergency department immediately.',
      sourceArticles: emergencyArticle ? [emergencyArticle] : [],
    };
  }

  // 2. Medication Alteration & Prescribing Guardrail
  if (MEDICATION_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return {
      status: 'unsupported_safe_fallback',
      answer:
        'Medication Safeguard: ReKnee AI cannot prescribe medication, recommend pharmaceuticals, or advise on altering prescription dosages. Please contact your orthopedic surgical team or dispensing pharmacist directly to discuss any changes to your pain management medications.',
      sourceArticles: [],
    };
  }

  // 3. Clinical Diagnosis & Examination Guardrail
  if (DIAGNOSIS_KEYWORDS.some((kw) => normalized.includes(kw))) {
    const woundArticle = eligibleArticles.find((a) => a.topic === 'wound_care');
    return {
      status: 'unsupported_safe_fallback',
      answer:
        'Clinical Boundary Notice: ReKnee AI is an educational recovery companion and cannot examine you, diagnose medical conditions, or confirm infections. If you are experiencing concerning symptoms such as worsening redness, spreading warmth, or oral fever over 100.4°F, please contact your surgical care team immediately.',
      sourceArticles: woundArticle ? [woundArticle] : [],
    };
  }

  // 4. Treatment Plan Override, Exercise Modification, & Safety Declaration Guardrail
  if (TREATMENT_OVERRIDE_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return {
      status: 'unsupported_safe_fallback',
      answer:
        'Clinical Protocol Notice: ReKnee AI cannot modify your prescribed rehabilitation plan, change prescribed exercises, create a new treatment plan, override your clinician, or declare you safe or fully cured. Any adjustments to your recovery regimen must be evaluated and authorized by your orthopedic surgeon or physical therapist.',
      sourceArticles: [],
    };
  }

  // 5. Grounded Retrieval across approved knowledge base
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 2);
  const scored = eligibleArticles.map((article) => {
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

  // If no reliable source exists in the approved knowledge base, refuse safely
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

  // Return grounded response synthesized strictly from approved clinical guidance
  return {
    status: 'answered',
    answer: `Based on your approved recovery guidance ("${primaryMatch.title}"): ${primaryMatch.content}`,
    sourceArticles: matchedSources,
  };
}
