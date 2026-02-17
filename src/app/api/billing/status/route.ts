// src/app/api/billing/status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStore } from '@/lib/auth';
import { BillingService } from '@/core/billing/billing-service';
import { PLANS } from '@/config/billing.config';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const store = await getAuthenticatedStore();
    if (!store) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const billingService = new BillingService();
    const status = await billingService.getSubscriptionStatus(store.id);

    return NextResponse.json({
      ...status,
      plans: PLANS,
    });
  } catch (error) {
    logger.error('Billing status error', { error });
    return NextResponse.json(
      { error: 'Failed to get billing status' },
      { status: 500 }
    );
  }
}
