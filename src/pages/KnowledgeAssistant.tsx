import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Send,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  HelpCircle,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { SourceCitation } from '../components/common/SourceCitation';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import { answerRecoveryQuestion } from '../lib/assistant/retrieval';
import { KnowledgeArticle } from '../types/database';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  sourceArticles?: KnowledgeArticle[];
  status?: string;
  timestamp: string;
}

const SUGGESTED_PROMPTS = [
  'How often should I put ice on my knee?',
  'Is sharp pain during exercise normal?',
  'What are the warning signs of infection?',
  'Can I double my pain medication dosage?',
  'What should I do if my calf is swollen and tender?',
];

export const KnowledgeAssistant: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

  const [inputQuestion, setInputQuestion] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [approvedArticles, setApprovedArticles] = useState<KnowledgeArticle[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const initialParamProcessedRef = useRef<boolean>(false);

  useEffect(() => {
    const loadKnowledge = async () => {
      const articles = await repository.getApprovedKnowledgeArticles();
      setApprovedArticles(articles);

      const history = await repository.getAssistantQuestions(activeProfile.id);
      if (history.length > 0) {
        const loadedChat: ChatMessage[] = [];
        history.reverse().forEach((q) => {
          loadedChat.push({
            id: 'u-' + q.id,
            sender: 'user',
            text: q.question,
            timestamp: q.created_at,
          });
          if (q.answer) {
            const matchedArticles = articles.filter(
              (a) => q.source_article_ids?.includes(a.id)
            );
            loadedChat.push({
              id: 'a-' + q.id,
              sender: 'assistant',
              text: q.answer,
              sourceArticles: matchedArticles,
              status: q.status,
              timestamp: q.created_at,
            });
          }
        });
        setMessages(loadedChat);
      } else {
        // Welcome initial message
        setMessages([
          {
            id: 'welcome',
            sender: 'assistant',
            text:
              'Hello Eleanor. I am your Recovery Knowledge Assistant. I answer questions strictly based on the recovery guidelines approved by your orthopedic surgical and physical therapy team. How can I support your recovery today?',
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    };

    loadKnowledge();
  }, [activeProfile.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam && approvedArticles.length > 0 && !initialParamProcessedRef.current) {
      initialParamProcessedRef.current = true;
      handleAsk(qParam);
    }
  }, [searchParams, approvedArticles]);

  const handleAsk = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || isThinking) return;

    setInputQuestion('');
    const userMsg: ChatMessage = {
      id: 'usr-' + Date.now(),
      sender: 'user',
      text: q,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      // Simulate slight realistic processing latency
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Grounded answering engine
      const result = answerRecoveryQuestion(q, approvedArticles);

      const assistantMsg: ChatMessage = {
        id: 'ast-' + Date.now(),
        sender: 'assistant',
        text: result.answer,
        sourceArticles: result.sourceArticles,
        status: result.status,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Save question and answer to persistence layer
      await repository.saveAssistantQuestion({
        patient_id: activeProfile.id,
        question: q,
        answer: result.answer,
        source_article_ids: result.sourceArticles.map((a) => a.id),
        status: result.status,
      });
    } catch (err) {
      console.error('Failed to answer question:', err);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-xl mx-auto space-y-3">
      {/* Top Header */}
      <div className="flex items-center justify-between shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-xs font-semibold text-slate-muted hover:text-navy-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </button>

        <Badge variant="teal" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
          Grounded Guidance
        </Badge>
      </div>

      {/* Description banner */}
      <div className="bg-warm-subtle/70 border border-warm-border rounded-xl p-2.5 text-xs text-slate-muted flex items-start gap-2 shrink-0">
        <Sparkles className="w-4 h-4 text-teal-calm shrink-0 mt-0.5" />
        <p>
          <strong className="text-navy-900 font-medium">Grounded in Clinical Protocol:</strong> Every answer is synthesized directly from approved care-team guidelines, with exact source citations attached.
        </p>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            } animate-fadeIn`}
          >
            <div
              className={`max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-navy-900 text-white rounded-br-none shadow-soft'
                  : msg.status === 'emergency_escalation'
                  ? 'bg-status-error-bg text-status-error border border-red-300 rounded-bl-none font-medium'
                  : 'bg-white text-navy-900 border border-warm-border rounded-bl-none shadow-soft'
              }`}
            >
              {msg.status === 'emergency_escalation' && (
                <div className="flex items-center gap-1.5 font-bold mb-1.5 text-status-error">
                  <AlertCircle className="w-4 h-4" />
                  <span>EMERGENCY SAFETY ESCALATION</span>
                </div>
              )}

              <p className="whitespace-pre-wrap">{msg.text}</p>

              {msg.sourceArticles && msg.sourceArticles.length > 0 && (
                <SourceCitation articles={msg.sourceArticles} />
              )}
            </div>

            <span className="text-[10px] text-slate-subtle mt-1 px-1">
              {new Date(msg.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        ))}

        {isThinking && (
          <div className="flex items-center gap-2 p-3 bg-white rounded-2xl rounded-bl-none border border-warm-border w-24">
            <span className="w-2 h-2 rounded-full bg-teal-calm animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-teal-calm animate-bounce [animation-delay:0.2s]" />
            <span className="w-2 h-2 rounded-full bg-teal-calm animate-bounce [animation-delay:0.4s]" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Topic Chips */}
      <div className="shrink-0 space-y-1.5 pt-1">
        <p className="text-[11px] font-semibold text-slate-muted flex items-center gap-1">
          <HelpCircle className="w-3 h-3 text-teal-calm" />
          <span>Suggested Questions:</span>
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {SUGGESTED_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleAsk(prompt)}
              className="text-[11px] bg-white border border-warm-border hover:border-teal-calm text-navy-900 px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 shadow-soft transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Question Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk(inputQuestion);
        }}
        className="flex gap-2 shrink-0 pt-1"
      >
        <input
          type="text"
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          placeholder="Ask about swelling, exercise discomfort, ice, or incision care..."
          className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-warm-border focus:border-teal-calm focus:ring-1 focus:ring-teal-calm bg-white text-navy-900 shadow-soft"
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={!inputQuestion.trim() || isThinking}
          icon={<Send className="w-4 h-4" />}
        >
          Ask
        </Button>
      </form>
    </div>
  );
};
