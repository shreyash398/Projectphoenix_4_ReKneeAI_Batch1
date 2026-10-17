import React from 'react';
import { BookOpen, ExternalLink, ShieldCheck } from 'lucide-react';
import { KnowledgeArticle } from '../../types/database';

interface SourceCitationProps {
  articles: KnowledgeArticle[];
  className?: string;
}

export const SourceCitation: React.FC<SourceCitationProps> = ({ articles, className = '' }) => {
  if (!articles || articles.length === 0) return null;

  return (
    <div className={`mt-3 pt-3 border-t border-warm-border text-xs text-slate-muted ${className}`}>
      <div className="flex items-center gap-1.5 font-medium text-navy-900 mb-2">
        <ShieldCheck className="w-3.5 h-3.5 text-teal-calm" />
        <span>Clinician-Approved Clinical Sources:</span>
      </div>
      <div className="space-y-1.5">
        {articles.map((art) => (
          <div
            key={art.id}
            className="flex items-start gap-2 bg-warm-bg/80 p-2 rounded-lg border border-warm-border/80"
          >
            <BookOpen className="w-3.5 h-3.5 text-teal-calm shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-navy-900 truncate">{art.title}</p>
              <p className="text-[11px] text-slate-subtle">{art.source_label} (v{art.version})</p>
            </div>
            {art.source_url && (
              <a
                href={art.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-teal-calm hover:text-teal-hover p-1"
                aria-label="Open source link"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
