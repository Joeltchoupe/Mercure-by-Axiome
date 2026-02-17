// src/app/api/metrics/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStore } from '@/lib/auth';
import { MetricsRepo } from '@/data/repositories/metrics.repo';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const store = await getAuthenticatedStore();

    if (!store) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') ?? '7d';

    const metricsRepo = new MetricsRepo();
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '24h':
        startDate = new Date(now);
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
    }

    const [aggregated, daily] = await Promise.all([
      metricsRepo.getAggregatedMetrics(store.id, startDate, now),
      metricsRepo.getDailyMetricsList(store.id, startDate, now),
    ]);

    return NextResponse.json({
      period,
      aggregated,
      daily,
    });
  } catch (error) {
    logger.error('GET /api/metrics error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
