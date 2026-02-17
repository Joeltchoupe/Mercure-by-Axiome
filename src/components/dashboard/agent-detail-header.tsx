// src/components/dashboard/agent-detail-header.tsx

'use client';

import { ArrowLeft, Power } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toggleAgent } from '@/app/dashboard/agents/actions';
import type { AgentType, AgentStats } from '@/types/agent';

interface AgentDetailHeaderProps {
  agentType: AgentType;
  enabled: boolean;
  stats24h: AgentStats | null;
  stats7d: AgentStats | null;
  storeId: string;
}

const AGENT_LABELS: Record<AgentType, string> = {
  conversion: 'Conversion Agent',
  retention: 'Retention Agent',
  support: 'Support Agent',
  acquisition: 'Acquisition Agent',
  operations: 'Operations Agent',
};

export function AgentDetailHeader({
  agentType,
  enabled,
  stats24h,
  stats7d,
  storeId,
}: AgentDetailHeaderProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/agents"
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-zinc-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-zinc-50">
              {AGENT_LABELS[agentType]}
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {enabled ? 'Active — processing events' : 'Disabled'}
            </p>
          </div>
        </div>

        <form action={toggleAgent}>
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="agentType" value={agentType} />
          <input type="hidden" name="enabled" value={(!enabled).toString()} />
          <button
            type="submit"
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              enabled
                ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            )}
          >
            <Power className="h-4 w-4" />
            {enabled ? 'Enabled' : 'Disabled'}
          </button>
        </form>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <StatBlock
          label="Runs (24h)"
          value={stats24h?.totalRuns?.toString() ?? '0'}
        />
        <StatBlock
          label="Actions (24h)"
          value={stats24h?.totalActions?.toString() ?? '0'}
        />
        <StatBlock
          label="Success Rate (7d)"
          value={stats7d ? `${stats7d.successRate.toFixed(0)}%` : '—'}
        />
        <StatBlock
          label="Avg Duration"
          value={stats7d?.avgDurationMs ? `${stats7d.avgDurationMs.toFixed(0)}ms` : '—'}
        />
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-zinc-200 mt-1">{value}</p>
    </div>
  );
  }
