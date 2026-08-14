import { cn } from '../utils';
import { ResultState } from '../types';

interface BadgeProps {
  state: ResultState;
  className?: string;
}

export function StateBadge({ state, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider',
        {
          'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20': state === 'SATISFIED',
          'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20': state === 'UNSATISFIED',
          'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/20': state === 'UNCERTAIN',
        },
        className
      )}
    >
      {state}
    </span>
  );
}
