import React from 'react';
import { Clause } from '../types';
import { StateBadge } from './Badge';
import { ExternalLink, Clock } from 'lucide-react';

interface ClauseCardProps {
  key?: React.Key;
  clause: Clause;
  onClick: (clause: Clause) => void;
}

export function ClauseCard({ clause, onClick }: ClauseCardProps) {
  return (
    <div 
      onClick={() => onClick(clause)}
      className="group bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-6 cursor-pointer transition-all duration-200"
    >
      <div className="flex justify-between items-start mb-4">
        <StateBadge state={clause.currentResult} />
        <span className="text-xs text-slate-400 font-mono">
          ID: {clause.id}
        </span>
      </div>
      
      <h3 className="font-serif text-xl text-slate-900 leading-snug mb-4 line-clamp-2">
        "{clause.condition}"
      </h3>
      
      <div className="flex items-center space-x-6 text-sm text-slate-500">
        <div className="flex items-center space-x-1.5 max-w-[200px]">
          <ExternalLink className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">
            {(() => {
              try { return new URL(clause.source).hostname; }
              catch { return clause.source; }
            })()}
          </span>
        </div>
        <div className="flex items-center space-x-1.5">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span>{clause.evaluationCount} eval{clause.evaluationCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex-grow text-right text-xs text-slate-400">
          Event Sequence #{clause.updatedAt}
        </div>
      </div>
    </div>
  );
}
