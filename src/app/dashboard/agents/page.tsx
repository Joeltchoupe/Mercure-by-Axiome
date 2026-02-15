// src/app/dashboard/agents/page.tsx

import { Suspense } from 'react';
import { getAuthenticatedStore } from '@/lib/auth';
import { AgentRunRepo } from '@/data/repositories/agent-run.repo';
import { AgentConfigRepo } from '@/data/repositories/agent-config.repo';
import { AgentCard } from '@/components/dashboard/agent-card';
import { AgentRunsTable } from '@/components/dashboard/agent-runs-table';
import { SkeletonCard } from '@/components/dashboard/skeleton-card';
import { AGENT_DEFAULTS } from '@/config/agents.config';
import type { AgentType } from '@/types/agent';

export default async function AgentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Agents</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Vos agents IA. Ce qu'ils font. Ce qu'ils décident.
        </p>
      </div>

      <Suspense fallback={<AgentGridSkeleton />}>
        <AgentGridSection />
      </Suspense>

      <Suspense fallback={<SkeletonCard className="h-96" />}>
        <AgentRunsSection />
      </Suspense>
    </div>
  );
}

async function AgentGridSection() {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  const agentConfigRepo = new AgentConfigRepo();
  const agentRunRepo = new AgentRunRepo();

  const now = new Date();
  const twentyFourHoursAgo = new Date(now);
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const agentTypes: AgentType[] = ['conversion', 'retention', 'support', 'acquisition', 'operations'];

  const agentData = await Promise.all(
    agentTypes.map(async (agentType) => {
      const [config, stats] = await Promise.all([
        agentConfigRepo.getConfig(store.id, agentType),
        agentRunRepo.getAgentStats(store.id, twentyFourHoursAgo, now, agentType),
      ]);

      return {
        type: agentType,
        enabled: config?.enabled ?? AGENT_DEFAULTS[agentType]?.enabled ?? false,
        config: config ?? AGENT_DEFAULTS[agentType],
        stats: stats,
      };
    })
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {agentData.map((agent) => (
        <AgentCard
          key={agent.type}
          type={agent.type}
          enabled={agent.enabled}
          stats={agent.stats}
          storeId={store.id}
        />
      ))}
    </div>
  );
}

async function AgentRunsSection() {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  const agentRunRepo = new AgentRunRepo();
  const runs = await agentRunRepo.getRecentRuns(store.id, { limit: 50 });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-200">Recent Decisions</h2>
      <AgentRunsTable runs={runs} />
    </div>
  );
}

function AgentGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonCard key={i} className="h-48" />
      ))}
    </div>
  );
    }
