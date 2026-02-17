// src/app/api/agents/decision/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStore } from '@/lib/auth';
import { AgentRunRepo } from '@/data/repositories/agent-run.repo';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const store = await getAuthenticatedStore();

    if (!store) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const agentType = searchParams.get('agent') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const agentRunRepo = new AgentRunRepo();

    const [runs, total] = await Promise.all([
      agentRunRepo.getRecentRuns(store.id, {
        limit: Math.min(limit, 200),
        offset,
        agentType,
        status,
      }),
      agentRunRepo.countRuns(store.id, { agentType, status }),
    ]);

    return NextResponse.json({
      runs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('GET /api/agents/decision error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
