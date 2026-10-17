import { describe, it, expect } from 'vitest';
import { answerRecoveryQuestion } from '../lib/assistant/retrieval';
import { KnowledgeArticle } from '../types/database';

describe('Grounded Recovery Assistant Retrieval', () => {
  const mockApprovedArticles: KnowledgeArticle[] = [
    {
      id: 'art-ice',
      title: 'Managing Normal Post-Op Swelling & Ice Protocol',
      content:
        'Applying an ice pack wrapped in a light towel for 15-20 minutes, 3 to 4 times a day, helps manage tissue inflammation.',
      source_label: 'Clinical Recovery Protocol v2.1',
      version: '2.1',
      topic: 'swelling_and_ice',
      approval_status: 'approved',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'art-pain',
      title: 'Pain During Exercise: Stretching vs. Sharp Distress',
      content:
        'Never force a joint through sharp mechanical pain. If pain escalates to 7 or above, rest the knee, apply ice, and log the incident.',
      source_label: 'Physical Therapy Practice Guidelines',
      version: '1.4',
      topic: 'exercise_pain',
      approval_status: 'approved',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'art-dvt',
      title: 'Red-Flag Alert: Deep Vein Thrombosis & Pulmonary Embolism',
      content:
        'If you develop sudden shortness of breath, unexplained chest pain, or severe calf tenderness, call emergency services (911) immediately.',
      source_label: 'Emergency Escalation Guidelines',
      version: '1.0',
      topic: 'emergency_dvt',
      approval_status: 'approved',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  it('answers questions accurately with source citations from approved articles', () => {
    const res = answerRecoveryQuestion('How long should I apply ice to my knee?', mockApprovedArticles);
    expect(res.status).toBe('answered');
    expect(res.answer).toContain('15-20 minutes');
    expect(res.sourceArticles.length).toBeGreaterThan(0);
    expect(res.sourceArticles[0].id).toBe('art-ice');
  });

  it('triggers emergency escalation when red-flag symptoms are mentioned', () => {
    const res = answerRecoveryQuestion('I have sudden chest pain and trouble breathing', mockApprovedArticles);
    expect(res.status).toBe('emergency_escalation');
    expect(res.answer).toContain('URGENT SAFETY NOTICE');
    expect(res.answer).toContain('911');
  });

  it('safely refuses to advise on altering prescription dosages', () => {
    const res = answerRecoveryQuestion('Can I double my pain medication dosage?', mockApprovedArticles);
    expect(res.status).toBe('unsupported_safe_fallback');
    expect(res.answer).toContain('Medication Safeguard');
    expect(res.answer).toContain('orthopedic surgical team');
  });

  it('provides a safe fallback without inventing facts when content is not found', () => {
    const res = answerRecoveryQuestion('What is the stock market doing today?', mockApprovedArticles);
    expect(res.status).toBe('unsupported_safe_fallback');
    expect(res.answer).toContain('I could not find an approved clinician instruction');
    expect(res.sourceArticles).toHaveLength(0);
  });
});
