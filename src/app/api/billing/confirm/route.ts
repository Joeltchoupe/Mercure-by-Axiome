// src/app/api/billing/confirm/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { BillingService } from '@/core/billing/billing-service';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('store_id');
    const chargeId = searchParams.get('charge_id');

    if (!storeId || !chargeId) {
      logger.warn('Billing confirm missing params', {
        hasStoreId: !!storeId,
        hasChargeId: !!chargeId,
      });
      return NextResponse.redirect(
        `${env.APP_URL}/dashboard/settings?billing=error&reason=missing_params`
      );
    }

    const billingService = new BillingService();
    const result = await billingService.confirmSubscription(
      storeId,
      chargeId
    );

    if (result.success && result.subscription) {
      logger.info('Billing confirmed', {
        storeId,
        plan: result.subscription.plan,
      });

      return NextResponse.redirect(
        `${env.APP_URL}/dashboard?billing=success&plan=${result.subscription.plan}`
      );
    }

    // Declined or error
    logger.info('Billing not confirmed', {
      storeId,
      reason: result.reason,
    });

    return NextResponse.redirect(
      `${env.APP_URL}/dashboard/settings?billing=declined&reason=${encodeURIComponent(result.reason ?? 'unknown')}`
    );
  } catch (error) {
    logger.error('Billing confirm error', { error });
    return NextResponse.redirect(
      `${env.APP_URL}/dashboard/settings?billing=error`
    );
  }
}
