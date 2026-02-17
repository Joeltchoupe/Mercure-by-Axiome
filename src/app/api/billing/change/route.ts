// src/app/api/billing/change/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStore } from '@/lib/auth';
import { BillingService } from '@/core/billing/billing-service';
import { isValidPlan } from '@/config/billing.config';
import { logger } from '@/lib/logger';
import type { BillingPlan } from '@/types/billing';

export async function POST(request: NextRequest) {
  try {
    const store = await getAuthenticatedStore();
    if (!store) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { plan } = body;

    if (!plan || !isValidPlan(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      );
    }

    const billingService = new BillingService();
    const { confirmationUrl, subscription } =
      await billingService.changePlan(store.id, plan as BillingPlan);

    return NextResponse.json({
      confirmationUrl,
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        priceUsd: subscription.priceUsd,
      },
    });
  } catch (error) {
    logger.error('Billing change error', { error });

    const message =
      error instanceof Error ? error.message : 'Failed to change plan';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
