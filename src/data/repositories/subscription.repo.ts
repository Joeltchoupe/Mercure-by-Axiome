// src/data/repositories/subscription.repo.ts

import { db } from '@/data/db';
import { logger } from '@/lib/logger';
import type { Subscription, BillingPlan, SubscriptionStatus } from '@/types/billing';

interface SubscriptionRow {
  id: string;
  store_id: string;
  shopify_charge_id: string | null;
  plan: BillingPlan;
  status: SubscriptionStatus;
  price_usd: string;
  trial_days: number;
  trial_ends_at: Date | null;
  activated_at: Date | null;
  cancelled_at: Date | null;
  current_period_start: Date | null;
  current_period_end: Date | null;
  confirmation_url: string | null;
  created_at: Date;
  updated_at: Date;
}

function rowToSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    storeId: row.store_id,
    shopifyChargeId: row.shopify_charge_id ?? '',
    plan: row.plan,
    status: row.status,
    priceUsd: parseFloat(row.price_usd),
    trialDays: row.trial_days,
    trialEndsAt: row.trial_ends_at,
    activatedAt: row.activated_at,
    cancelledAt: row.cancelled_at,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    confirmationUrl: row.confirmation_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SubscriptionRepo {
  async getActiveByStoreId(storeId: string): Promise<Subscription | null> {
    const result = await db.query<SubscriptionRow>(
      `SELECT * FROM subscriptions
       WHERE store_id = $1 AND status IN ('active', 'pending')
       ORDER BY created_at DESC
       LIMIT 1`,
      [storeId]
    );

    if (result.rows.length === 0) return null;
    return rowToSubscription(result.rows[0]);
  }

  async getByShopifyChargeId(chargeId: string): Promise<Subscription | null> {
    const result = await db.query<SubscriptionRow>(
      'SELECT * FROM subscriptions WHERE shopify_charge_id = $1',
      [chargeId]
    );

    if (result.rows.length === 0) return null;
    return rowToSubscription(result.rows[0]);
  }

  async getByStoreId(storeId: string): Promise<Subscription[]> {
    const result = await db.query<SubscriptionRow>(
      'SELECT * FROM subscriptions WHERE store_id = $1 ORDER BY created_at DESC',
      [storeId]
    );

    return result.rows.map(rowToSubscription);
  }

  async create(params: {
    storeId: string;
    shopifyChargeId: string;
    plan: BillingPlan;
    priceUsd: number;
    trialDays: number;
    confirmationUrl: string;
  }): Promise<Subscription> {
    // Cancel any existing pending subscriptions for this store
    await db.query(
      `UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW()
       WHERE store_id = $1 AND status = 'pending'`,
      [params.storeId]
    );

    const trialEndsAt = params.trialDays > 0
      ? new Date(Date.now() + params.trialDays * 24 * 60 * 60 * 1000)
      : null;

    const result = await db.query<SubscriptionRow>(
      `INSERT INTO subscriptions (
        store_id, shopify_charge_id, plan, status, price_usd,
        trial_days, trial_ends_at, confirmation_url
      ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
      RETURNING *`,
      [
        params.storeId,
        params.shopifyChargeId,
        params.plan,
        params.priceUsd,
        params.trialDays,
        trialEndsAt,
        params.confirmationUrl,
      ]
    );

    logger.info('Subscription created', {
      storeId: params.storeId,
      plan: params.plan,
      chargeId: params.shopifyChargeId,
    });

    return rowToSubscription(result.rows[0]);
  }

  async activate(
    shopifyChargeId: string
  ): Promise<Subscription | null> {
    const now = new Date();

    const result = await db.query<SubscriptionRow>(
      `UPDATE subscriptions
       SET
         status = 'active',
         activated_at = $2,
         current_period_start = $2,
         current_period_end = $2 + INTERVAL '30 days',
         updated_at = NOW()
       WHERE shopify_charge_id = $1
       RETURNING *`,
      [shopifyChargeId, now]
    );

    if (result.rows.length === 0) return null;

    const sub = rowToSubscription(result.rows[0]);

    // Update store billing status
    await db.query(
      `UPDATE stores SET billing_plan = $2, billing_status = 'active' WHERE id = $1`,
      [sub.storeId, sub.plan]
    );

    logger.info('Subscription activated', {
      storeId: sub.storeId,
      plan: sub.plan,
      chargeId: shopifyChargeId,
    });

    return sub;
  }

  async cancel(storeId: string): Promise<Subscription | null> {
    const result = await db.query<SubscriptionRow>(
      `UPDATE subscriptions
       SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
       WHERE store_id = $1 AND status IN ('active', 'pending')
       RETURNING *`,
      [storeId]
    );

    if (result.rows.length === 0) return null;

    // Update store billing status
    await db.query(
      `UPDATE stores SET billing_plan = NULL, billing_status = 'cancelled' WHERE id = $1`,
      [storeId]
    );

    const sub = rowToSubscription(result.rows[0]);

    logger.info('Subscription cancelled', {
      storeId,
      plan: sub.plan,
    });

    return sub;
  }

  async decline(shopifyChargeId: string): Promise<Subscription | null> {
    const result = await db.query<SubscriptionRow>(
      `UPDATE subscriptions
       SET status = 'declined', updated_at = NOW()
       WHERE shopify_charge_id = $1
       RETURNING *`,
      [shopifyChargeId]
    );

    if (result.rows.length === 0) return null;

    const sub = rowToSubscription(result.rows[0]);

    logger.info('Subscription declined', {
      storeId: sub.storeId,
      plan: sub.plan,
      chargeId: shopifyChargeId,
    });

    return sub;
  }

  async freeze(storeId: string): Promise<void> {
    await db.query(
      `UPDATE subscriptions SET status = 'frozen', updated_at = NOW()
       WHERE store_id = $1 AND status = 'active'`,
      [storeId]
    );

    await db.query(
      `UPDATE stores SET billing_status = 'frozen' WHERE id = $1`,
      [storeId]
    );

    logger.info('Subscription frozen', { storeId });
  }

  async changePlan(
    storeId: string,
    newPlan: BillingPlan,
    newChargeId: string,
    newPriceUsd: number,
    confirmationUrl: string
  ): Promise<Subscription> {
    // Cancel current subscription
    await this.cancel(storeId);

    // Create new one
    return this.create({
      storeId,
      shopifyChargeId: newChargeId,
      plan: newPlan,
      priceUsd: newPriceUsd,
      trialDays: 0, // No trial on plan change
      confirmationUrl,
    });
  }

  async isActive(storeId: string): Promise<boolean> {
    const sub = await this.getActiveByStoreId(storeId);
    return sub?.status === 'active';
  }

  async getActivePlan(storeId: string): Promise<BillingPlan | null> {
    const sub = await this.getActiveByStoreId(storeId);
    if (!sub || sub.status !== 'active') return null;
    return sub.plan;
  }

  async getSubscriptionStats(): Promise<{
    total: number;
    active: number;
    byPlan: Record<string, number>;
    mrr: number;
  }> {
    const result = await db.query<{
      total: string;
      active: string;
      plan: string;
      plan_count: string;
      plan_revenue: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM subscriptions) as total,
         (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') as active,
         plan,
         COUNT(*) as plan_count,
         SUM(price_usd) as plan_revenue
       FROM subscriptions
       WHERE status = 'active'
       GROUP BY plan`
    );

    const byPlan: Record<string, number> = {};
    let mrr = 0;

    for (const row of result.rows) {
      byPlan[row.plan] = parseInt(row.plan_count, 10);
      mrr += parseFloat(row.plan_revenue);
    }

    return {
      total: parseInt(result.rows[0]?.total ?? '0', 10),
      active: parseInt(result.rows[0]?.active ?? '0', 10),
      byPlan,
      mrr,
    };
  }
}
