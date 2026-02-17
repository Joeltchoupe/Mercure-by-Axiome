// src/core/billing/billing-service.ts

import { ShopifyBillingClient } from '@/integrations/shopify/billing';
import { SubscriptionRepo } from '@/data/repositories/subscription.repo';
import { StoreRepo } from '@/data/repositories/store.repo';
import { AgentConfigRepo } from '@/data/repositories/agent-config.repo';
import { PLANS, getPlan } from '@/config/billing.config';
import { AGENT_DEFAULTS } from '@/config/agents.config';
import { decrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import type { BillingPlan, Subscription, UsageMetrics } from '@/types/billing';
import type { AgentType } from '@/types/agent';

export class BillingService {
  private subscriptionRepo: SubscriptionRepo;
  private storeRepo: StoreRepo;
  private agentConfigRepo: AgentConfigRepo;

  constructor() {
    this.subscriptionRepo = new SubscriptionRepo();
    this.storeRepo = new StoreRepo();
    this.agentConfigRepo = new AgentConfigRepo();
  }

  // ─── Create Subscription ───

  async createSubscription(
    storeId: string,
    plan: BillingPlan
  ): Promise<{ confirmationUrl: string; subscription: Subscription }> {
    const store = await this.storeRepo.getById(storeId);
    if (!store) throw new Error('Store not found');

    const planDetails = getPlan(plan);
    const accessToken = decrypt(store.accessToken);

    const billingClient = new ShopifyBillingClient(
      store.shopifyDomain,
      accessToken
    );

    const returnUrl = `${env.APP_URL}/api/billing/confirm?store_id=${storeId}`;

    const { chargeId, confirmationUrl } =
      await billingClient.createRecurringCharge({
        name: `Axiome ${planDetails.name}`,
        price: planDetails.priceUsd,
        trialDays: planDetails.trialDays,
        returnUrl,
        test: !env.isProduction,
      });

    const subscription = await this.subscriptionRepo.create({
      storeId,
      shopifyChargeId: chargeId,
      plan,
      priceUsd: planDetails.priceUsd,
      trialDays: planDetails.trialDays,
      confirmationUrl,
    });

    logger.info('Subscription creation initiated', {
      storeId,
      plan,
      chargeId,
    });

    return { confirmationUrl, subscription };
  }

  // ─── Confirm Subscription (callback from Shopify) ───

  async confirmSubscription(
    storeId: string,
    chargeId: string
  ): Promise<{
    success: boolean;
    subscription: Subscription | null;
    reason?: string;
  }> {
    const store = await this.storeRepo.getById(storeId);
    if (!store) {
      return { success: false, subscription: null, reason: 'Store not found' };
    }

    const accessToken = decrypt(store.accessToken);
    const billingClient = new ShopifyBillingClient(
      store.shopifyDomain,
      accessToken
    );

    // Check charge status on Shopify
    const charge = await billingClient.getRecurringCharge(chargeId);

    if (charge.status === 'declined') {
      await this.subscriptionRepo.decline(chargeId);

      logger.info('Subscription declined by merchant', {
        storeId,
        chargeId,
      });

      return {
        success: false,
        subscription: null,
        reason: 'Merchant declined the charge',
      };
    }

    if (charge.status === 'accepted' || charge.status === 'active') {
      // Activate on Shopify side if accepted but not yet active
      if (charge.status === 'accepted') {
        await billingClient.activateRecurringCharge(chargeId);
      }

      // Activate in our DB
      const subscription = await this.subscriptionRepo.activate(chargeId);

      if (subscription) {
        // Apply plan limits to agent configs
        await this.applyPlanLimits(storeId, subscription.plan);

        logger.info('Subscription activated', {
          storeId,
          plan: subscription.plan,
          chargeId,
        });
      }

      return { success: true, subscription };
    }

    // Unexpected status
    logger.warn('Unexpected charge status', {
      storeId,
      chargeId,
      status: charge.status,
    });

    return {
      success: false,
      subscription: null,
      reason: `Unexpected charge status: ${charge.status}`,
    };
  }

  // ─── Cancel Subscription ───

  async cancelSubscription(storeId: string): Promise<Subscription | null> {
    const store = await this.storeRepo.getById(storeId);
    if (!store) throw new Error('Store not found');

    const activeSub = await this.subscriptionRepo.getActiveByStoreId(storeId);
    if (!activeSub) return null;

    // Cancel on Shopify
    try {
      const accessToken = decrypt(store.accessToken);
      const billingClient = new ShopifyBillingClient(
        store.shopifyDomain,
        accessToken
      );
      await billingClient.cancelRecurringCharge(activeSub.shopifyChargeId);
    } catch (error) {
      logger.warn('Failed to cancel charge on Shopify', {
        storeId,
        chargeId: activeSub.shopifyChargeId,
        error,
      });
      // Continue with local cancellation
    }

    // Cancel locally
    const cancelled = await this.subscriptionRepo.cancel(storeId);

    // Disable agents that exceed free tier
    await this.disableExcessAgents(storeId);

    return cancelled;
  }

  // ─── Change Plan ───

  async changePlan(
    storeId: string,
    newPlan: BillingPlan
  ): Promise<{ confirmationUrl: string; subscription: Subscription }> {
    const currentSub =
      await this.subscriptionRepo.getActiveByStoreId(storeId);

    if (currentSub?.plan === newPlan) {
      throw new Error('Already on this plan');
    }

    // Cancel current on Shopify
    if (currentSub) {
      await this.cancelSubscription(storeId);
    }

    // Create new subscription
    return this.createSubscription(storeId, newPlan);
  }

  // ─── Get Status ───

  async getSubscriptionStatus(storeId: string): Promise<{
    hasSubscription: boolean;
    subscription: Subscription | null;
    plan: BillingPlan | null;
    isActive: boolean;
    isTrial: boolean;
    trialDaysRemaining: number | null;
    usage: UsageMetrics | null;
  }> {
    const subscription =
      await this.subscriptionRepo.getActiveByStoreId(storeId);

    if (!subscription) {
      return {
        hasSubscription: false,
        subscription: null,
        plan: null,
        isActive: false,
        isTrial: false,
        trialDaysRemaining: null,
        usage: null,
      };
    }

    const isActive = subscription.status === 'active';
    const isTrial =
      isActive &&
      subscription.trialEndsAt !== null &&
      subscription.trialEndsAt > new Date();

    let trialDaysRemaining: number | null = null;
    if (isTrial && subscription.trialEndsAt) {
      trialDaysRemaining = Math.ceil(
        (subscription.trialEndsAt.getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      );
    }

    let usage: UsageMetrics | null = null;
    if (isActive) {
      usage = await this.getUsageMetrics(storeId);
    }

    return {
      hasSubscription: true,
      subscription,
      plan: subscription.plan,
      isActive,
      isTrial,
      trialDaysRemaining,
      usage,
    };
  }

  // ─── Usage Tracking ───

  async getUsageMetrics(storeId: string): Promise<UsageMetrics> {
    const { db } = await import('@/data/db');

    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [eventsTodayResult, eventsMonthResult, costResult, vectorResult, agentResult] =
      await Promise.all([
        db.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM events
           WHERE store_id = $1 AND received_at >= $2`,
          [storeId, today]
        ),
        db.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM events
           WHERE store_id = $1 AND received_at >= $2`,
          [storeId, monthStart]
        ),
        db.query<{ today_cost: string; month_cost: string }>(
          `SELECT
             COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= $2), 0) as today_cost,
             COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= $3), 0) as month_cost
           FROM agent_runs WHERE store_id = $1`,
          [storeId, today, monthStart]
        ),
        db.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM vector_documents WHERE store_id = $1`,
          [storeId]
        ).catch(() => ({ rows: [{ count: '0' }] })),
        db.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM agent_configs
           WHERE store_id = $1 AND enabled = true`,
          [storeId]
        ),
      ]);

    return {
      eventsToday: parseInt(eventsTodayResult.rows[0].count, 10),
      eventsThisMonth: parseInt(eventsMonthResult.rows[0].count, 10),
      llmCostToday: parseFloat(costResult.rows[0].today_cost),
      llmCostThisMonth: parseFloat(costResult.rows[0].month_cost),
      vectorDocuments: parseInt(vectorResult.rows[0].count, 10),
      activeAgents: parseInt(agentResult.rows[0].count, 10),
    };
  }

  // ─── Enforce Plan Limits ───

  async checkPlanLimits(
    storeId: string
  ): Promise<{ withinLimits: boolean; violations: string[] }> {
    const plan = await this.subscriptionRepo.getActivePlan(storeId);
    if (!plan) {
      return { withinLimits: false, violations: ['No active subscription'] };
    }

    const planDetails = getPlan(plan);
    const usage = await this.getUsageMetrics(storeId);
    const violations: string[] = [];

    if (usage.eventsToday > planDetails.limits.maxEventsPerDay) {
      violations.push(
        `Daily event limit exceeded: ${usage.eventsToday}/${planDetails.limits.maxEventsPerDay}`
      );
    }

    if (usage.llmCostThisMonth > planDetails.limits.maxLlmCostPerMonthUsd) {
      violations.push(
        `Monthly LLM budget exceeded: $${usage.llmCostThisMonth.toFixed(2)}/$${planDetails.limits.maxLlmCostPerMonthUsd}`
      );
    }

    if (usage.activeAgents > planDetails.limits.maxAgents) {
      violations.push(
        `Active agents exceeded: ${usage.activeAgents}/${planDetails.limits.maxAgents}`
      );
    }

    if (usage.vectorDocuments > planDetails.limits.vectorDocuments) {
      violations.push(
        `Vector documents exceeded: ${usage.vectorDocuments}/${planDetails.limits.vectorDocuments}`
      );
    }

    return {
      withinLimits: violations.length === 0,
      violations,
    };
  }

  // ─── Internal Helpers ───

  private async applyPlanLimits(
    storeId: string,
    plan: BillingPlan
  ): Promise<void> {
    const planDetails = getPlan(plan);

    // Update store budget settings based on plan
    await this.storeRepo.updateSettings(storeId, {
      dailyLlmBudgetUsd: Math.min(
        planDetails.limits.maxLlmCostPerMonthUsd / 30,
        100
      ),
      monthlyLlmBudgetUsd: planDetails.limits.maxLlmCostPerMonthUsd,
    });

    // Enable/disable agents based on plan
    const allAgents: AgentType[] = [
      'conversion',
      'retention',
      'support',
      'acquisition',
      'operations',
    ];

    for (let i = 0; i < allAgents.length; i++) {
      const agentType = allAgents[i];
      const shouldBeEnabled = i < planDetails.limits.maxAgents;
      const defaultEnabled = AGENT_DEFAULTS[agentType].enabled;

      await this.agentConfigRepo.upsertConfig(storeId, agentType, {
        enabled: shouldBeEnabled && defaultEnabled,
      });
    }

    logger.info('Plan limits applied', { storeId, plan });
  }

  private async disableExcessAgents(storeId: string): Promise<void> {
    // Disable all agents when no subscription
    const allAgents: AgentType[] = [
      'conversion',
      'retention',
      'support',
      'acquisition',
      'operations',
    ];

    for (const agentType of allAgents) {
      await this.agentConfigRepo.upsertConfig(storeId, agentType, {
        enabled: false,
      });
    }

    logger.info('All agents disabled (no subscription)', { storeId });
  }
}
