// src/components/dashboard/agent-runs-table.tsx

import { cn } from '@/lib/utils';
import { formatDistanceToNow } from '@/lib/utils';
import type { AgentRun } from '@/types/agent';

interface AgentRunsTableProps {
  runs: AgentRun[];
  showAgent?: boolean;
}

export function AgentRunsTable({ runs, showAgent = true }: AgentRunsTableProps) {
  if (runs.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
        <p className="text-sm text-zinc-500">No decisions yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">
                Status
              </th>
              {showAgent && (
                <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">
                  Agent
                </th>
              )}
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">
                Action
              </th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">
                Reasoning
              </th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">
                Confidence
              </th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">
                Duration
              </th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">
                Cost
              </th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">
                When
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {runs.map((run) => (
              <tr key={run.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-3">
                  <StatusBadge status={run.status} />
                </td>
                {showAgent && (
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-zinc-400 uppercase">
                      {run.agentType}
                    </span>
                  </td>
                )}
                <td className="px-4 py-3">
                  <span className="text-zinc-200 font-mono text-xs">
                    {run.decision?.action ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <p className="text-xs text-zinc-400 truncate">
                    {run.decision?.reasoning ?? '—'}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {run.decision?.confidence !== undefined && (
                    <ConfidenceBar value={run.decision.confidence} />
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-zinc-500">
                    {run.durationMs !== undefined ? `${run.durationMs}ms` : '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-zinc-500">
                    {run.costUsd !== undefined ? `$${run.costUsd.toFixed(4)}` : '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-zinc-500">
                    {formatDistanceToNow(run.createdAt)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
        status === 'success' && 'bg-emerald-500/10 text-emerald-500',
        status === 'error' && 'bg-red-500/10 text-red-500',
        status === 'skipped' && 'bg-zinc-700/50 text-zinc-400'
      )}
    >
      {status}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full',
            value >= 0.8
              ? 'bg-emerald-500'
              : value >= 0.5
                ? 'bg-amber-500'
                : 'bg-red-500'
          )}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span className="text-xs text-zinc-500">{(value * 100).toFixed(0)}%</span>
    </div>
  );
              }
