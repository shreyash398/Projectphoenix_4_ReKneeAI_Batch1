// ReKnee AI - Recovery Knowledge Assistant
// Strictly adheres to 01_PRD.md, 03_ARCHITECTURE.md, 04_DATABASE.md, 05_API.md, 09_FEATURE_DEVELOPMENT.md, 13_EXTERNAL_INTEGRATION.md, and 16_SECURITY_AUDIT.md
// Demonstrates grounded answers synthesized strictly from approved clinical guidance with explicit source citations

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Send,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  HelpCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  X,
  Trash2,
  Clock,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import { askAssistantQuestion } from '../lib/assistant/assistantClient';
import { ChatMessage } from '../lib/assistant/types';
import { KnowledgeArticle } from '../types/database';

const SUGGESTED_PROMPTS = [
  "What's today's recovery plan?",
  'What should I know about my exercise?',
  'When should I contact my care team?',
  'How often should I put ice on my knee?',
  'Is sharp pain during exercise normal?',
  'What are the warning signs of infection?',
];

export const KnowledgeAssistant: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

  const [inputQuestion, setInputQuestion] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [approvedArticles, setApprovedArticles] = useState<KnowledgeArticle[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const initialParamProcessedRef = useRef<boolean>(false);

  // Load knowledge articles and prior conversation history
  useEffect(() => {
    let isMounted = true;
    const loadKnowledgeAndHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const [articles, history] = await Promise.all([
          repository.getApprovedKnowledgeArticles(),
          repository.getAssistantQuestions(activeProfile.id),
        ]);

        if (!isMounted) return;
        setApprovedArticles(articles);

        if (history.length > 0) {
          const loadedChat: ChatMessage[] = [];
          [...history].reverse().forEach((q) => {
            loadedChat.push({
              id: 'u-' + q.id,
              sender: 'user',
              text: q.question,
              timestamp: q.created_at,
            });

            if (q.answer) {
              const matchedArticles = articles.filter((a) =>
                q.source_article_ids?.includes(a.id)
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
          // Welcome message explaining grounded recovery bounds
          setMessages([
            {
              id: 'welcome',
              sender: 'assistant',
              text:
                'Hello Eleanor. I am your Recovery Knowledge Assistant. I answer questions strictly from the post-operative recovery guidance approved by your orthopedic surgical and physical therapy care team. How can I support your recovery today?',
              timestamp: new Date().toISOString(),
              status: 'answered',
            },
          ]);
        }
      } catch (err) {
        console.error('Failed to load assistant history:', err);
        if (isMounted) {
          setErrorMessage('Could not load previous conversation history.');
        }
      } finally {
        if (isMounted) setIsLoadingHistory(false);
      }
    };

    loadKnowledgeAndHistory();
    return () => {
      isMounted = false;
    };
  }, [activeProfile.id]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Handle asking a question
  const handleAsk = useCallback(
    async (questionText: string) => {
      const q = questionText.trim();
      if (!q || isThinking) return;

      // Character limit guard (16_SECURITY_AUDIT.md)
      if (q.length > 500) {
        setErrorMessage('Question exceeds maximum allowed length of 500 characters.');
        return;
      }

      setInputQuestion('');
      setErrorMessage(null);

      const userMsg: ChatMessage = {
        id: 'usr-' + Date.now(),
        sender: 'user',
        text: q,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsThinking(true);

      try {
        // Send request to server-side endpoint with grounded retrieval
        const response = await askAssistantQuestion(q, activeProfile.id);

        // Find full article metadata for citations
        let matchedSources = response.sourceArticles;
        if (!matchedSources || matchedSources.length === 0) {
          matchedSources = approvedArticles.filter((a) =>
            response.sourceArticleIds?.includes(a.id)
          );
        }

        const assistantMsg: ChatMessage = {
          id: 'ast-' + Date.now(),
          sender: 'assistant',
          text: response.answer,
          sourceArticles: matchedSources,
          status: response.status,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // Persist interaction to database
        await repository.saveAssistantQuestion({
          patient_id: activeProfile.id,
          question: q,
          answer: response.answer,
          source_article_ids: response.sourceArticleIds,
          status: response.status,
        });
      } catch (err: unknown) {
        const errorObj = err as Error;
        console.error('Assistant error:', errorObj);
        setErrorMessage(
          errorObj.message || 'Unable to generate an answer right now. Please try again.'
        );
      } finally {
        setIsThinking(false);
      }
    },
    [activeProfile.id, approvedArticles, isThinking]
  );

  // Handle URL query parameter prefill (?q=...)
  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam && !initialParamProcessedRef.current) {
      initialParamProcessedRef.current = true;
      handleAsk(qParam);
    }
  }, [searchParams, handleAsk]);

  // Clear current chat session view
  const handleClearSession = () => {
    setMessages([
      {
        id: 'welcome-' + Date.now(),
        sender: 'assistant',
        text:
          'Session cleared. I am ready to answer your questions strictly from your approved recovery instructions. How can I help?',
        timestamp: new Date().toISOString(),
        status: 'answered',
      },
    ]);
    setErrorMessage(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto space-y-4 pb-2 px-2 sm:px-0">
      {/* Top Header */}
      <div className="flex items-center justify-between shrink-0 pb-3 border-b border-slate-200/60">
        <div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy-900 transition-colors p-1 rounded-lg mb-1"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Recovery Home</span>
          </button>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
            Recovery Assistant
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Ask about your approved recovery information and post-operative protocol.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="teal" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
            Approved Clinical Sources
          </Badge>

          {messages.length > 1 && (
            <button
              onClick={handleClearSession}
              title="Clear current view"
              className="text-slate-400 hover:text-navy-900 p-2 rounded-xl hover:bg-slate-100 transition-colors text-xs flex items-center gap-1.5 border border-slate-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Error Notice */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-center justify-between shrink-0 shadow-soft animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-100 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-1">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center p-8 text-xs text-slate-subtle gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-teal-calm" />
            <span>Loading recovery history...</span>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              } animate-fadeIn`}
            >
              {msg.sender === 'user' ? (
                // User Message Bubble
                <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-none p-3.5 text-xs leading-relaxed bg-navy-900 text-white shadow-soft">
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              ) : (
                // Assistant Answer Card
                <div
                  className={`w-full max-w-[95%] sm:max-w-[90%] rounded-2xl rounded-bl-none p-4 text-xs leading-relaxed shadow-soft border ${
                    msg.status === 'emergency_escalation'
                      ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                      : msg.status === 'unsupported_safe_fallback'
                      ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                      : 'bg-white border-warm-border text-navy-900'
                  }`}
                >
                  {/* Card Header Status Indicator */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-warm-border/60">
                    <div className="flex items-center gap-1.5 font-semibold">
                      {msg.status === 'emergency_escalation' ? (
                        <>
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span className="text-rose-700 font-bold uppercase tracking-wide">
                            Urgent Safety Escalation
                          </span>
                        </>
                      ) : msg.status === 'unsupported_safe_fallback' ? (
                        <>
                          <Info className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="text-amber-800 font-semibold">
                            Clinical Boundary Notice
                          </span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 text-teal-calm shrink-0" />
                          <span className="text-teal-hover font-semibold">
                            Approved Recovery Guidance
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-slate-subtle">
                      <Clock className="w-3 h-3" />
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>

                  {/* Verifiable Source Citations */}
                  {msg.sourceArticles && msg.sourceArticles.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-warm-border/70 text-xs">
                      <div className="flex items-center gap-1.5 font-medium text-navy-900 mb-2">
                        <BookOpen className="w-3.5 h-3.5 text-teal-calm" />
                        <span>Verifiable Clinical Citations:</span>
                      </div>
                      <div className="space-y-1.5">
                        {msg.sourceArticles.map((art) => (
                          <div
                            key={art.id}
                            className="flex items-start justify-between gap-2 bg-warm-bg/90 p-2.5 rounded-lg border border-warm-border/80"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-navy-900 truncate">
                                {art.title}
                              </p>
                              <p className="text-[11px] text-slate-subtle mt-0.5">
                                {art.source_label} (v{art.version})
                              </p>
                            </div>
                            {art.source_url && (
                              <a
                                href={art.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-teal-calm hover:text-teal-hover p-1 rounded transition-colors"
                                aria-label={`Read reference for ${art.title}`}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Timestamp label below user bubble */}
              {msg.sender === 'user' && (
                <span className="text-[10px] text-slate-subtle mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          ))
        )}

        {/* Loading / Searching State */}
        {isThinking && (
          <div className="flex items-center gap-2.5 p-3.5 bg-white rounded-2xl rounded-bl-none border border-warm-border w-56 shadow-soft animate-fadeIn">
            <span className="w-2 h-2 rounded-full bg-teal-calm animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-teal-calm animate-bounce [animation-delay:0.2s]" />
            <span className="w-2 h-2 rounded-full bg-teal-calm animate-bounce [animation-delay:0.4s]" />
            <span className="text-xs text-slate-muted font-medium ml-1">
              Searching approved guidelines...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Question Cards */}
      <div className="shrink-0 space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-teal-calm" />
            <span>Suggested Inquiries</span>
          </p>
          <span className="text-[10px] text-slate-400 font-medium">Grounded in Clinical Protocol</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {SUGGESTED_PROMPTS.slice(0, 3).map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAsk(prompt)}
              disabled={isThinking}
              className="text-left p-2.5 rounded-xl bg-white border border-slate-200/90 hover:border-teal-calm hover:bg-teal-50/30 transition-all text-xs text-navy-900 font-medium shadow-soft group disabled:opacity-50"
            >
              <span className="line-clamp-2">{prompt}</span>
              <span className="text-[10px] font-semibold text-teal-calm block mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                Ask prompt →
              </span>
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
        className="space-y-1.5 shrink-0 pt-1"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            maxLength={500}
            disabled={isThinking}
            placeholder="Ask about swelling, exercise discomfort, ice protocol, or wound care..."
            className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-warm-border focus:border-teal-calm focus:ring-1 focus:ring-teal-calm bg-white text-navy-900 shadow-soft disabled:bg-warm-subtle transition-all placeholder:text-slate-subtle"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!inputQuestion.trim() || isThinking}
            icon={isThinking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          >
            {isThinking ? 'Searching' : 'Ask'}
          </Button>
        </div>

        {/* Character Counter & Safety Disclaimer */}
        <div className="flex justify-between items-center text-[10px] text-slate-subtle px-1">
          <span>Not a diagnostic tool. Does not provide medical advice. For medical emergencies call 911.</span>
          <span>{inputQuestion.length}/500</span>
        </div>
      </form>
    </div>
  );
};
