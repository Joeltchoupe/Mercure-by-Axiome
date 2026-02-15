// src/components/dashboard/agent-activity-feed.tsx

import { Bot, ArrowRight, CheckCircle, XCircle, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentRun } from '@/types/agent';
import { formatDistanceToNow } from '@/lib/utils';

interface AgentActivityFeedProps {
  runs: AgentRun[];
}

export function AgentActivityFeed({ runs }: AgentActivityFeedProps) {
  if (runs.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
        <Bot className="h-8 w-8 text-zinc-600 mx-auto" />
        <p className="text-sm text-zinc-500 mt-3">
          Aucune activité agent pour le moment.
        </p>
        <p className="text-xs text-zinc-600 mt-1">
          Les agents commenceront à agir dès réception des premiers événements Shopify.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-200">Recent Agent Activity</h2>
      </div>
      <div className="divide-y divide-zinc-800/50">
        {runs.map((run) => (
          <ActivityRow key={run.id} run={run} />
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ run }: { run: AgentRun }) {
  const StatusIcon =
    run.status === 'success'
      ? CheckCircle
      : run.status === 'error'
        ? XCircle
        : MinusCircle;

  const statusColor =
    run.status === 'success'
      ? 'text-emerald-500'
      : run.status === 'error'
        ? 'text-red-500'
        : 'text-zinc-500';

  return (
    <div className="px-5 py-3 flex items-center gap-4">
      <StatusIcon className={cn('h-4 w-4 flex-shrink-0', statusColor)} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            {run.agentType}
          </span>
          <ArrowRight className="h-3 w-3 text-zinc-600" />
          <span className="text-sm text-zinc-300 truncate">
            {run.decision?.action ?? 'NO_ACTION'}
          </span>
        </div>
        {run.decision?.reasoning && (
          <p className="text-xs text-zinc-500 mt-0.5 truncate">
            {run.decision.reasoning}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
        {run.durationMs !== undefined && (
          <span className="text-xs text-zinc-600">{run.durationMs}ms</span>
        )}
        <span className="text-xs text-zinc-600">
          {formatDistanceToNow(run.createdAt)}
        </span>
      </div>
    </div>
  );
    }
