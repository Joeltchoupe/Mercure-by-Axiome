// src/app/dashboard/activity/page.tsx

import { Suspense } from 'react';
import { getAuthenticatedStore } from '@/lib/auth';
import { EventRepo } from '@/data/repositories/event.repo';
import { AgentRunRepo } from '@/data/repositories/agent-run.repo';
import { EventsTimeline } from '@/components/dashboard/events-timeline';
import { ActivityFilters } from '@/components/dashboard/activity-filters';
import { SkeletonCard } from '@/components/dashboard/skeleton-card';

interface ActivityPageProps {
  searchParams: {
    type?: string;
    agent?: string;
    status?: string;
    page?: string;
  };
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const page = parseInt(searchParams.page ?? '1', 10);
  const filters = {
    eventType: searchParams.type ?? undefined,
    agentType: searchParams.agent ?? undefined,
    status: searchParams.status ?? undefined,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Activity</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Tout ce qui se passe. Chaque événement. Chaque décision.
        </p>
      </div>

      <ActivityFilters currentFilters={filters} />

      <Suspense fallback={<SkeletonCard className="h-[600px]" />}>
        <TimelineSection filters={filters} page={page} />
      </Suspense>
    </div>
  );
}

async function TimelineSection({
  filters,
  page,
}: {
  filters: { eventType?: string; agentType?: string; status?: string };
  page: number;
}) {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  const eventRepo = new EventRepo();
  const agentRunRepo = new AgentRunRepo();

  const limit = 50;
  const offset = (page - 1) * limit;

  const [events, runs, totalEvents] = await Promise.all([
    eventRepo.getEvents(store.id, {
      type: filters.eventType,
      limit,
      offset,
    }),
    agentRunRepo.getRecentRuns(store.id, {
      limit: 200,
      agentType: filters.agentType,
      status: filters.status,
    }),
    eventRepo.countEvents(store.id, { type: filters.eventType }),
  ]);

  // Map runs to their trigger events for timeline correlation
  const runsByEventId = new Map(
    runs.map((run) => [run.triggerEventId, run])
  );

  const timelineItems = events.map((event) => ({
    event,
    agentRun: runsByEventId.get(event.id) ?? null,
  }));

  const totalPages = Math.ceil(totalEvents / limit);

  return (
    <EventsTimeline
      items={timelineItems}
      currentPage={page}
      totalPages={totalPages}
    />
  );
    }
