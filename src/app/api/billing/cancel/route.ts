// src/app/api/billing/cancel/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStore } from '@/lib/auth';
import { BillingService } from '@/core/billing/billing-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const store = await getAuthenticatedStore();
    if (!store) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const billingService = new BillingService();
    const cancelled = await billingService.cancelSubscription(store.id);

    if (!cancelled) {
      return NextResponse.json(
        { error: 'No active subscription to cancel' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: 'cancelled',
      plan: cancelled.plan,
      cancelledAt: cancelled.cancelledAt,
    });
  } catch (error) {
    logger.error('Billing cancel error', { error });
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
