export type ResultState = 'SATISFIED' | 'UNSATISFIED' | 'UNCERTAIN';

export type TransactionState = 'IDLE' | 'CONNECTING_WALLET' | 'WRONG_NETWORK' | 'SUBMITTING' | 'WAITING_FOR_FINALIZATION' | 'RELOADING_STATE' | 'SUCCESS' | 'ERROR';

export interface ClauseEvaluation {
  id: string;
  clauseId: string;
  result: ResultState;
  evidence: string;
  reasonCode: string;
  evaluatedAt: number;
}

export interface Clause {
  id: string;
  creator: string;
  condition: string;
  source: string;
  currentResult: ResultState;
  evaluationCount: number;
  createdAt: number;
  updatedAt: number;
  history: ClauseEvaluation[];
}
