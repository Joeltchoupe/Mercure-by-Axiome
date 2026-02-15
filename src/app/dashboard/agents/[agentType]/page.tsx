// src/app/dashboard/agents/[agentType]/page.tsx

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getAuthenticatedStore } from '@/lib/auth';
import { AgentRunRepo } from '@/data/repositories/agent-run.repo';
import { AgentConfigRepo } from '@/data/repositories/agent-config.repo';
import { AgentDetailHeader } from '@/components/dashboard/agent-detail-header';
import { AgentConfigPanel } from '@/components/dashboard/agent-config-panel';
import { AgentPerformanceChart } from '@/components/dashboard/agent-performance-chart';
import { AgentRunsTable } from '@/components/dashboard/agent-runs-table';
import { SkeletonCard } from '@/components/dashboard/skeleton-card';
import { AGENT_DEFAULTS } from '@/config/agents.config';
import type { AgentType } from '@/types/agent';

const VALID_AGENT_TYPES: AgentType[] = [
  'conversion',
  'retention',
  'support',
  'acquisition',
  'operations',
];

interface AgentDetailPageProps {
  params: { agentType: string };
}

export default async function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { agentType } = params;

  if (!VALID_AGENT_TYPES.includes(agentType as AgentType)) {
    notFound();
  }

  const typedAgentType = agentType as AgentType;

  return (
    <div className="space-y-6">
      <Suspense fallback={<SkeletonCard className="h-32" />}>
        <AgentDetailSection agentType={typedAgentType} />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Suspense fallback={<SkeletonCard className="h-72" />}>
            <PerformanceSection agentType={typedAgentType} />
          </Suspense>
        </div>
        <div>
          <Suspense fallback={<SkeletonCard className="h-72" />}>
            <ConfigSection agentType={typedAgentType} />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<SkeletonCard className="h-96" />}>
        <RunsSection agentType={typedAgentType} />
      </Suspense>
    </div>
  );
}

async function AgentDetailSection({ agentType }: { agentType: AgentType }) {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  const agentConfigRepo = new AgentConfigRepo();
  const agentRunRepo = new AgentRunRepo();

  const now = new Date();
  const twentyFourHoursAgo = new Date(now);
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [config, stats24h, stats7d] = await Promise.all([
    agentConfigRepo.getConfig(store.id, agentType),
    agentRunRepo.getAgentStats(store.id, twentyFourHoursAgo, now, agentType),
    agentRunRepo.getAgentStats(store.id, sevenDaysAgo, now, agentType),
  ]);

  return (
    <AgentDetailHeader
      agentType={agentType}
      enabled={config?.enabled ?? AGENT_DEFAULTS[agentType]?.enabled ?? false}
      stats24h={stats24h}
      stats7d={stats7d}
      storeId={store.id}
    />
  );
}

async function PerformanceSection({ agentType }: { agentType: AgentType }) {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  const agentRunRepo = new AgentRunRepo();

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyStats = await agentRunRepo.getDailyAgentStats(
    store.id,
    agentType,
    thirtyDaysAgo,
    now
  );

  return <AgentPerformanceChart data={dailyStats} agentType={agentType} />;
}

async function ConfigSection({ agentType }: { agentType: AgentType }) {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  const agentConfigRepo = new AgentConfigRepo();
  const config = await agentConfigRepo.getConfig(store.id, agentType);

  return (
    <AgentConfigPanel
      agentType={agentType}
      config={config ?? AGENT_DEFAULTS[agentType]}
      storeId={store.id}
    />
  );
}

async function RunsSection({ agentType }: { agentType: AgentType }) {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  const agentRunRepo = new AgentRunRepo();
  const runs = await agentRunRepo.getRecentRuns(store.id, {
    limit: 100,
    agentType,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-200">Decision History</h2>
      <AgentRunsTable runs={runs} showAgent={false} />
    </div>
  );
  }
