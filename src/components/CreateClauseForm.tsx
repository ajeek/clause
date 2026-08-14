import React, { useState } from 'react';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { TransactionState } from '../types';

interface CreateClauseFormProps {
  onBack: () => void;
  onSubmit: (condition: string, source: string, setTxState: (state: TransactionState) => void) => Promise<void>;
  walletConnected: boolean;
}

export function CreateClauseForm({ onBack, onSubmit, walletConnected }: CreateClauseFormProps) {
  const [condition, setCondition] = useState('');
  const [source, setSource] = useState('');
  const [txState, setTxState] = useState<TransactionState>('IDLE');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condition.trim() || !source.trim()) return;
    
    setError(null);
    try {
      await onSubmit(condition, source, setTxState);
    } catch (e: any) {
      setError(e.message || "Failed to create clause.");
      setTxState('ERROR');
    }
  };

  const isSubmitting = ['SUBMITTING', 'WAITING_FOR_FINALIZATION', 'RELOADING_STATE'].includes(txState);

  const getStatusText = () => {
    switch (txState) {
      case 'SUBMITTING': return 'Submitting to GenLayer...';
      case 'WAITING_FOR_FINALIZATION': return 'Waiting for Finalization...';
      case 'RELOADING_STATE': return 'Verifying canonical state...';
      default: return 'Create Clause';
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
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
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <h1 className="text-2xl font-serif text-slate-900">Create Clause</h1>
          <p className="text-sm text-slate-500 mt-2">
            Bind an immutable condition to a specific external source.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label htmlFor="condition" className="block text-sm font-medium text-slate-700 mb-2">
              Condition
            </label>
            <textarea
              id="condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="e.g., Arc uses USDC as its native gas token."
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-0 outline-none transition-colors resize-none font-serif text-lg text-slate-900"
              required
            />
          </div>

          <div>
            <label htmlFor="source" className="block text-sm font-medium text-slate-700 mb-2">
              Source URL
            </label>
            <input
              type="url"
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-0 outline-none transition-colors text-slate-900"
              required
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !condition.trim() || !source.trim() || !walletConnected}
              className="inline-flex items-center space-x-2 px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{getStatusText()}</span>
                </>
              ) : !walletConnected ? (
                <>
                  <span>Connect Wallet to Submit</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Create Clause</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
