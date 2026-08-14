import { useState } from 'react';
import { Clause, ResultState, TransactionState } from '../types';
import { StateBadge } from './Badge';
import { ArrowLeft, ExternalLink, Activity, RefreshCw, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ClauseDetailProps {
  clause: Clause;
  onBack: () => void;
  onEvaluate: (clauseId: string, setTxState: (state: TransactionState) => void) => Promise<void>;
  walletConnected: boolean;
}

export function ClauseDetail({ clause, onBack, onEvaluate, walletConnected }: ClauseDetailProps) {
  const [txState, setTxState] = useState<TransactionState>('IDLE');
  const [error, setError] = useState<string | null>(null);

  const handleEvaluate = async () => {
    setError(null);
    try {
      await onEvaluate(clause.id, setTxState);
    } catch (e: any) {
      setError(e.message || "Evaluation transaction failed.");
      setTxState('ERROR');
    }
  };

  const getResultIcon = (state: ResultState) => {
    switch (state) {
      case 'SATISFIED': return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'UNSATISFIED': return <XCircle className="w-5 h-5 text-rose-600" />;
      case 'UNCERTAIN': return <HelpCircle className="w-5 h-5 text-slate-400" />;
      default: return <HelpCircle className="w-5 h-5 text-slate-400" />;
    }
  };

  const isEvaluating = ['SUBMITTING', 'WAITING_FOR_FINALIZATION', 'RELOADING_STATE'].includes(txState);

  const getStatusText = () => {
    switch (txState) {
      case 'SUBMITTING': return 'Submitting to GenLayer...';
      case 'WAITING_FOR_FINALIZATION': return 'Waiting for Finalization...';
      case 'RELOADING_STATE': return 'Verifying canonical state...';
      default: return 'Evaluate Condition';
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <button 
        onClick={onBack}
        className="flex items-center space-x-2 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-8 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Back to Clauses</span>
      </button>

      {error && (
        <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 px-6 py-4 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-8 md:p-10 border-b border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <span className="text-xs font-mono text-slate-400">CLAUSE {clause.id}</span>
            <StateBadge state={clause.currentResult} className="px-3 py-1 text-sm" />
          </div>

          <h1 className="font-serif text-3xl md:text-4xl text-slate-900 leading-tight mb-8">
            "{clause.condition}"
          </h1>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <a 
              href={clause.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800 transition-colors bg-blue-50/50 px-4 py-2 rounded-lg w-fit"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="truncate max-w-[300px]">{clause.source}</span>
            </a>

            <button
              onClick={handleEvaluate}
              disabled={isEvaluating || !walletConnected}
              className="inline-flex items-center justify-center space-x-2 px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              {isEvaluating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{getStatusText()}</span>
                </>
              ) : !walletConnected ? (
                <>
                  <span>Connect Wallet to Evaluate</span>
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4" />
                  <span>Evaluate Condition</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-slate-50/50 p-8 md:p-10">
          <h2 className="text-sm font-bold tracking-wider text-slate-400 uppercase mb-8">
            Evaluation History
          </h2>
          
          <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
            <AnimatePresence initial={false}>
              {!clause.history || clause.history.length === 0 ? (
                <div className="text-center text-sm text-slate-500 py-8 relative z-10">
                  No evaluations yet.
                </div>
              ) : (
                clause.history.map((evalRecord, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={evalRecord.id} 
                    className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                      {getResultIcon(evalRecord.result)}
                    </div>
                    
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <StateBadge state={evalRecord.result} />
                        <span className="text-xs text-slate-400 font-mono">
                          Event Sequence #{evalRecord.evaluatedAt}
                        </span>
                      </div>
                      
                      <div className="text-xs font-mono text-slate-500 mb-2">
                        {evalRecord.reasonCode}
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {evalRecord.evidence}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
