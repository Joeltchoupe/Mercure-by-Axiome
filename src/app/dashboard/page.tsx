// src/app/dashboard/page.tsx

import { Suspense } from 'react';
import { getAuthenticatedStore } from '@/lib/auth';
import { MetricsRepo } from '@/data/repositories/metrics.repo';
import { AgentRunRepo } from '@/data/repositories/agent-run.repo';
import { MetricCard } from '@/components/dashboard/metric-card';
import { AgentActivityFeed } from '@/components/dashboard/agent-activity-feed';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { AgentStatusGrid } from '@/components/dashboard/agent-status-grid';
import { DailyBriefing } from '@/components/dashboard/daily-briefing';
import { SkeletonCard } from '@/components/dashboard/skeleton-card';

export default async function DashboardOverview() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Overview</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Votre système tourne. Voici ce qui compte.
        </p>
      </div>

      <Suspense fallback={<BriefingSkeleton />}>
        <DailyBriefingSection />
      </Suspense>

      <Suspense fallback={<MetricsSkeleton />}>
        <MetricsSection />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Suspense fallback={<SkeletonCard className="h-80" />}>
            <RevenueSection />
          </Suspense>
        </div>
        <div>
          <Suspense fallback={<SkeletonCard className="h-80" />}>
            <AgentStatusSection />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<SkeletonCard className="h-96" />}>
        <ActivitySection />
      </Suspense>
    </div>
  );
}

async function DailyBriefingSection() {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  const metricsRepo = new MetricsRepo();
  const agentRunRepo = new AgentRunRepo();

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [todayMetrics, yesterdayMetrics, recentRuns] = await Promise.all([
    metricsRepo.getDailyMetrics(store.id, today),
    metricsRepo.getDailyMetrics(store.id, yesterday),
    agentRunRepo.getRecentRuns(store.id, { limit: 50, since: yesterday }),
  ]);

  return (
    <DailyBriefing
      todayMetrics={todayMetrics}
      yesterdayMetrics={yesterdayMetrics}
      recentRuns={recentRuns}
      storeName={store.shopifyDomain}
    />
  );
}

async function MetricsSection() {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  const metricsRepo = new MetricsRepo();

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [currentPeriod, previousPeriod] = await Promise.all([
    metricsRepo.getAggregatedMetrics(store.id, sevenDaysAgo, today),
    metricsRepo.getAggregatedMetrics(store.id, fourteenDaysAgo, sevenDaysAgo),
  ]);

  const metrics = [
    {
      label: 'Revenue',
      value: currentPeriod.revenue,
      previousValue: previousPeriod.revenue,
      format: 'currency' as const,
    },
    {
      label: 'Orders',
      value: currentPeriod.orders,
      previousValue: previousPeriod.orders,
      format: 'number' as const,
    },
    {
      label: 'Conversion Rate',
      value: currentPeriod.conversionRate,
      previousValue: previousPeriod.conversionRate,
      format: 'percentage' as const,
    },
    {
      label: 'AOV',
      value: currentPeriod.avgOrderValue,
      previousValue: previousPeriod.avgOrderValue,
      format: 'currency' as const,
    },
    {
      label: 'Returning Customers',
      value: currentPeriod.returningCustomers,
      previousValue: previousPeriod.returningCustomers,
      format: 'number' as const,
    },
    {
      label: 'Agent Actions',
      value: currentPeriod.agentActions,
      previousValue: previousPeriod.agentActions,
      format: 'number' as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </div>
  );
}

async function RevenueSection() {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  const metricsRepo = new MetricsRepo();

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyMetrics = await metricsRepo.getDailyMetricsList(
    store.id,
    thirtyDaysAgo,
    today
  );

  return <RevenueChart data={dailyMetrics} />;
}

async function AgentStatusSection() {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  const agentRunRepo = new AgentRunRepo();

  const today = new Date();
  const twentyFourHoursAgo = new Date(today);
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const agentStats = await agentRunRepo.getAgentStats(
    store.id,
    twentyFourHoursAgo,
    today
  );

  return <AgentStatusGrid stats={agentStats} />;
}

async function ActivitySection() {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  const agentRunRepo = new AgentRunRepo();

  const runs = await agentRunRepo.getRecentRuns(store.id, { limit: 20 });

  return <AgentActivityFeed runs={runs} />;
}

function BriefingSkeleton() {
  return <SkeletonCard className="h-40" />;
}

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} className="h-24" />
      ))}
    </div>
  );
}
