import React, { useState, useEffect, useCallback } from 'react';
import { ExecutionResult, TransactionStatus } from 'genlayer-js/types';
import { Clause, TransactionState } from './types';
import { ClauseCard } from './components/ClauseCard';
import { ClauseDetail } from './components/ClauseDetail';
import { CreateClauseForm } from './components/CreateClauseForm';
import { Plus, Wallet, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getReadClient, getWriteClient } from './genlayer';
import { studionet } from 'genlayer-js/chains';
import { CLAUSE_CONTRACT_ADDRESS } from './config';

const inFlightRequests = new Map<string, Promise<any>>();

const deduplicateRequest = <T,>(key: string, fetcher: () => Promise<T>): Promise<T> => {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key) as Promise<T>;
  }
  const promise = fetcher().finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, promise);
  return promise;
};

export default function App() {
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [view, setView] = useState<'list' | 'detail' | 'create'>('list');
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  
  const [address, setAddress] = useState<string | null>(null);
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalClauses, setTotalClauses] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 10;

  const selectedClause = clauses.find(c => c.id === selectedClauseId) || null;

  const checkNetwork = useCallback(async () => {
    if (!(window as any).ethereum) return;
    try {
      const chainId = await (window as any).ethereum.request({ method: 'eth_chainId' });
      // studionet ID is typically what viem provides, or we can just ensure it matches studionet.id
      setIsWrongNetwork(Number(chainId) !== studionet.id);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const connectWallet = async () => {
    if (!(window as any).ethereum) {
      setError("Please install a GenLayer-compatible browser wallet (e.g. MetaMask).");
      return;
    }
    try {
      const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        await checkNetwork();
      }
    } catch (e: any) {
      setError(e.message || "Failed to connect wallet.");
    }
  };

  const switchNetwork = async () => {
    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${studionet.id.toString(16)}` }],
      });
      await checkNetwork();
    } catch (e: any) {
      setError(e.message || "Failed to switch network.");
    }
  };

  const fetchClauses = useCallback(async (startIndex: number, count: number) => {
    const client = getReadClient();
    const endIdx = Math.max(0, startIndex - count + 1);
    const chunk: Clause[] = [];
    for (let i = startIndex; i >= endIdx; i--) {
      try {
        const c: any = await deduplicateRequest(`get_clause:${i}`, () =>
          client.readContract({
            address: CLAUSE_CONTRACT_ADDRESS as `0x${string}`,
            functionName: 'get_clause',
            args: [i],
          })
        );
        chunk.push({
          id: c.id.toString(),
          creator: c.creator,
          condition: c.condition,
          source: c.source,
          currentResult: c.current_result,
          evaluationCount: Number(c.evaluation_count),
          createdAt: Number(c.created_marker), // Assuming marker acts as timestamp or sequence
          updatedAt: Number(c.updated_marker),
          history: [], // History loaded on demand
        });
      } catch (err) {
        console.error(`Failed to read clause ${i}`, err);
      }
    }
    return chunk;
  }, []);

  const loadRegistry = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const client = getReadClient();
      const stats: any = await deduplicateRequest('get_stats', () =>
        client.readContract({
          address: CLAUSE_CONTRACT_ADDRESS as `0x${string}`,
          functionName: 'get_stats',
          args: [],
        })
      );
      
      const total = Number(stats.total_clauses || 0);
      setTotalClauses(total);
      
      if (total > 0) {
        const chunk = await fetchClauses(total - 1, ITEMS_PER_PAGE);
        setClauses(chunk);
      } else {
        setClauses([]);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load registry from GenLayer.");
    } finally {
      setIsLoading(false);
    }
  }, [fetchClauses]);

  const loadMore = async () => {
    if (isLoadingMore || clauses.length >= totalClauses) return;
    try {
      setIsLoadingMore(true);
      const startIndex = totalClauses - 1 - clauses.length;
      if (startIndex < 0) return;
      
      const chunk = await fetchClauses(startIndex, ITEMS_PER_PAGE);
      setClauses(prev => [...prev, ...chunk]);
    } catch (e: any) {
      setError(e.message || "Failed to load more clauses.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    const handleAccountsChanged = (accs: string[]) => {
      if (accs.length > 0) {
        setAddress(accs[0]);
      } else {
        setAddress(null);
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    const init = async () => {
      if ((window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          await checkNetwork();
        }
        (window as any).ethereum.on('accountsChanged', handleAccountsChanged);
        (window as any).ethereum.on('chainChanged', handleChainChanged);
      }
      await loadRegistry();
    };
    init();

    return () => {
      if ((window as any).ethereum) {
        (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
        (window as any).ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [loadRegistry, checkNetwork]);

  const handleCreate = async (condition: string, source: string, setTxState: (state: TransactionState) => void) => {
    if (!address || isWrongNetwork) return;
    
    try {
      setTxState('SUBMITTING');
      const client = getWriteClient(address as `0x${string}`);
      const hash = await client.writeContract({
        address: CLAUSE_CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'create_clause',
        args: [condition, source],
        value: 0n,
      });
      
      setTxState('WAITING_FOR_FINALIZATION');
      const receipt = await client.waitForTransactionReceipt({ 
        hash,
        status: TransactionStatus.FINALIZED,
        retries: 60,
        interval: 2000
      });
      
      if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
        throw new Error("Transaction execution failed (reverted on GenLayer).");
      }
      
      // QUALIS FAILURE PREVENTION:
      // Authoritatively extract the returned u256 ID directly from the execution result
      const execResult = (receipt as any).execution_result || (receipt as any).txExecutionResult;
      
      const readClient = getReadClient();
      let newId: string;
      
      if (execResult) {
        newId = BigInt(execResult).toString();
      } else {
        const stats: any = await deduplicateRequest('get_stats', () =>
          readClient.readContract({
            address: CLAUSE_CONTRACT_ADDRESS as `0x${string}`,
            functionName: 'get_stats',
            args: [],
          })
        );
        const total = Number(stats.total_clauses || 0);
        if (total === 0) {
          throw new Error("Synchronization Error: No clauses found after creation.");
        }
        newId = (total - 1).toString();
      }

      setTxState('RELOADING_STATE');
      // Verify canonical state
      const newClauseData: any = await deduplicateRequest(`get_clause:${newId}`, () =>
        readClient.readContract({
          address: CLAUSE_CONTRACT_ADDRESS as `0x${string}`,
          functionName: 'get_clause',
          args: [BigInt(newId)],
        })
      );

      if (newClauseData.condition !== condition || newClauseData.source !== source) {
        throw new Error("State synchronization failed: Canonical Clause data mismatch.");
      }

      const newClause: Clause = {
        id: newClauseData.id.toString(),
        creator: newClauseData.creator,
        condition: newClauseData.condition,
        source: newClauseData.source,
        currentResult: newClauseData.current_result,
        evaluationCount: Number(newClauseData.evaluation_count),
        createdAt: Number(newClauseData.created_marker),
        updatedAt: Number(newClauseData.updated_marker),
        history: [],
      };

      setClauses(prev => {
        const exists = prev.find(c => c.id === newClause.id);
        if (exists) {
          return prev.map(c => c.id === newClause.id ? newClause : c);
        }
        return [newClause, ...prev];
      });
      setTotalClauses(prev => Math.max(prev, Number(newId) + 1));

      setTxState('SUCCESS');
      setSelectedClauseId(newId);
      setView('detail');
    } catch (err: any) {
      throw new Error(err.message || "Failed to create clause.");
    }
  };

  const handleEvaluate = async (clauseId: string, setTxState: (state: TransactionState) => void) => {
    if (!address || isWrongNetwork) return;
    
    try {
      setTxState('SUBMITTING');
      const client = getWriteClient(address as `0x${string}`);
      const hash = await client.writeContract({
        address: CLAUSE_CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'evaluate_clause',
        args: [BigInt(clauseId)],
        value: 0n,
      });
      
      setTxState('WAITING_FOR_FINALIZATION');
      const receipt = await client.waitForTransactionReceipt({ 
        hash,
        status: TransactionStatus.FINALIZED,
        retries: 60,
        interval: 2000
      });
      
      if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
        throw new Error("Transaction execution failed (reverted on GenLayer).");
      }
      
      setTxState('RELOADING_STATE');
      // Re-read canonical state explicitly
      const readClient = getReadClient();
      
      const fetchWithRecovery = async <T,>(key: string, fetcher: () => Promise<T>): Promise<T> => {
        try {
          return await deduplicateRequest(key, fetcher);
        } catch (e: any) {
          if (e.message?.includes('Failed to fetch') || String(e).includes('Failed to fetch')) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            return await deduplicateRequest(key, fetcher);
          }
          throw e;
        }
      };

      const updatedClause: any = await fetchWithRecovery(`get_clause:${clauseId}`, () =>
        readClient.readContract({
          address: CLAUSE_CONTRACT_ADDRESS as `0x${string}`,
          functionName: 'get_clause',
          args: [BigInt(clauseId)],
        })
      );
      
      let historyData: any = null;
      try {
        historyData = await fetchWithRecovery(`get_clause_history:${clauseId}`, () =>
          readClient.readContract({
            address: CLAUSE_CONTRACT_ADDRESS as `0x${string}`,
            functionName: 'get_clause_history',
            args: [BigInt(clauseId)],
          })
        );
      } catch (err: any) {
        console.warn("Non-fatal error: Failed to fetch clause history after evaluation:", err);
      }

      setClauses(prev => prev.map(c => {
        if (c.id !== clauseId) return c;
        
        let newHistory = c.history;
        if (historyData) {
          newHistory = historyData.map((h: any) => ({
            id: h.id.toString(),
            clauseId: h.clause_id.toString(),
            result: h.result,
            evidence: h.evidence,
            reasonCode: h.reason_code,
            evaluatedAt: Number(h.evaluated_marker)
          })).reverse(); // Display newest first
        }

        return {
          ...c,
          currentResult: updatedClause.current_result,
          evaluationCount: Number(updatedClause.evaluation_count),
          updatedAt: Number(updatedClause.updated_marker),
          history: newHistory
        };
      }));
      setTxState('SUCCESS');
    } catch (err: any) {
      throw new Error(err.message || "Failed to evaluate clause.");
    }
  };

  const loadClauseHistory = async (clauseId: string) => {
    try {
      const client = getReadClient();
      const historyData: any = await client.readContract({
        address: CLAUSE_CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'get_clause_history',
        args: [BigInt(clauseId)],
      });
      
      setClauses(prev => prev.map(c => {
        if (c.id !== clauseId) return c;
        return {
          ...c,
          history: historyData.map((h: any) => ({
            id: h.id.toString(),
            clauseId: h.clause_id.toString(),
            result: h.result,
            evidence: h.evidence,
            reasonCode: h.reason_code,
            evaluatedAt: Number(h.evaluated_marker)
          })).reverse()
        };
      }));
    } catch (err) {
      console.error("Failed to load history", err);
    }
  };

  const handleSelectClause = (c: Clause) => {
    setSelectedClauseId(c.id);
    setView('detail');
    loadClauseHistory(c.id);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-slate-200">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <button 
            onClick={() => { setView('list'); setSelectedClauseId(null); }}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity text-left"
          >
            <div className="w-11 h-11 bg-[#0A0F1C] flex items-center justify-center rounded-[0.6rem] shrink-0">
              <svg viewBox="0 0 32 32" className="w-7 h-7" xmlns="http://www.w3.org/2000/svg">
                <path d="M 23 8 L 12 8 C 9.79 8 8 9.79 8 12 L 8 20 C 8 22.21 9.79 24 12 24 L 23 24" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M 11 16 L 23 16" stroke="#5B64E9" strokeWidth="3" strokeLinecap="round" fill="none" />
              </svg>
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-serif font-bold text-2xl text-[#0A0F1C] leading-none tracking-tight">Clause Protocol</span>
              <span className="text-[0.6rem] font-bold text-[#5B64E9] tracking-[0.15em] mt-1 uppercase leading-none">Conditions. Sources. Verified.</span>
            </div>
          </button>
          
          <div className="flex items-center space-x-4">
            <nav className="flex items-center space-x-1 border-r border-slate-200 pr-4">
              <button
                onClick={() => setView('create')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  view === 'create' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>New Clause</span>
                </div>
              </button>
            </nav>

            {address ? (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-mono bg-slate-100 text-slate-600 px-3 py-1.5 rounded-md">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
                {isWrongNetwork && (
                  <button onClick={switchNetwork} className="text-xs bg-rose-100 text-rose-700 px-3 py-1.5 rounded-md hover:bg-rose-200 font-medium transition-colors flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Wrong Network</span>
                  </button>
                )}
              </div>
            ) : (
              <button onClick={connectWallet} className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2 text-sm font-medium rounded-md hover:bg-slate-800 transition-colors">
                <Wallet className="w-4 h-4" />
                <span>Connect Wallet</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-700 px-6 py-3 text-sm text-center">
          {error}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {view === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="mb-10">
                <h1 className="text-3xl font-serif text-slate-900 mb-2">Source-Bound Conditions</h1>
                <p className="text-slate-500 text-sm">
                  Evaluate external conditions and track their state over time through GenLayer.
                </p>
              </div>
              
              {isLoading ? (
                <div className="text-center py-12 text-slate-400">Loading registry from GenLayer...</div>
              ) : error ? (
                <div className="text-center py-12 text-slate-400">Failed to load registry. Please try again.</div>
              ) : clauses.length === 0 ? (
                <div className="text-center py-12 text-slate-400">No clauses found in registry.</div>
              ) : (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {clauses.map(clause => (
                      <ClauseCard 
                        key={clause.id} 
                        clause={clause} 
                        onClick={handleSelectClause}
                      />
                    ))}
                  </div>
                  
                  {clauses.length < totalClauses && (
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={loadMore}
                        disabled={isLoadingMore}
                        className="px-6 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-full hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-sm"
                      >
                        {isLoadingMore ? (
                          <>
                            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                            <span>Loading...</span>
                          </>
                        ) : (
                          <span>Load More</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {view === 'detail' && selectedClause && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ClauseDetail 
                clause={selectedClause} 
                onBack={() => { setView('list'); setSelectedClauseId(null); }}
                onEvaluate={handleEvaluate}
                walletConnected={!!address && !isWrongNetwork}
              />
            </motion.div>
          )}

          {view === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <CreateClauseForm 
                onBack={() => setView('list')}
                onSubmit={handleCreate}
                walletConnected={!!address && !isWrongNetwork}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
