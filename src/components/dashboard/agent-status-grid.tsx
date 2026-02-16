// src/components/dashboard/agent-status-grid.tsx

import {
  ShoppingCart,
  Heart,
  Headphones,
  Megaphone,
  Package,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentStats, AgentType } from '@/types/agent';

interface AgentStatusGridProps {
  stats: Record<AgentType, AgentStats> | AgentStats[];
}

const AGENT_ICONS: Record<AgentType, React.ElementType> = {
  conversion: ShoppingCart,
  retention: Heart,
  support: Headphones,
  acquisition: Megaphone,
  operations: Package,
};

const AGENT_COLORS: Record<AgentType, string> = {
  conversion: 'text-blue-500',
  retention: 'text-pink-500',
  support: 'text-green-500',
  acquisition: 'text-amber-500',
  operations: 'text-purple-500',
};

export function AgentStatusGrid({ stats }: AgentStatusGridProps) {
  const statEntries: [AgentType, AgentStats][] = Array.isArray(stats)
    ? (stats.map((s) => [s.agentType, s]) as [AgentType, AgentStats][])
    : (Object.entries(stats) as [AgentType, AgentStats][]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-zinc-200 mb-4">
        Agent Status — Last 24h
      </h2>
      <div className="space-y-3">
        {statEntries.map(([agentType, agentStats]) => {
          const Icon = AGENT_ICONS[agentType];
          const color = AGENT_COLORS[agentType];
          const isHealthy = agentStats.successRate >= 80;

          return (
            <div
              key={agentType}
              className="flex items-center justify-between py-2"
            >
              <div className="flex items-center gap-3">
                <Icon className={cn('h-4 w-4', color)} />
                <span className="text-sm text-zinc-300 capitalize">
                  {agentType}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">
                  {agentStats.totalRuns} runs
                </span>
                {isHealthy ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
