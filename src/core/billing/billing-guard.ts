// src/core/billing/billing-guard.ts

import { SubscriptionRepo } from '@/data/repositories/subscription.repo';
import { BillingService } from '@/core/billing/billing-service';
import { getPlan } from '@/config/billing.config';
import { logger } from '@/lib/logger';
import type { AgentType } from '@/types/agent';

export class BillingGuard {
  private subscriptionRepo: SubscriptionRepo;
  private billingService: BillingService;

  constructor() {
    this.subscriptionRepo = new SubscriptionRepo();
    this.billingService = new BillingService();
  }

  async canProcessEvent(storeId: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // Check subscription exists and is active
    const sub = await this.subscriptionRepo.getActiveByStoreId(storeId);

    if (!sub) {
      return {
        allowed: false,
        reason: 'No active subscription',
      };
    }

    if (sub.status !== 'active') {
      return {
        allowed: false,
        reason: `Subscription status: ${sub.status}`,
      };
    }

    // Check daily event limit
    const planDetails = getPlan(sub.plan);
    const usage = await this.billingService.getUsageMetrics(storeId);

    if (
      planDetails.limits.maxEventsPerDay !== -1 &&
      usage.eventsToday >= planDetails.limits.maxEventsPerDay
    ) {
      return {
        allowed: false,
        reason: `Daily event limit reached: ${usage.eventsToday}/${planDetails.limits.maxEventsPerDay}`,
      };
    }

    // Check monthly LLM budget
    if (
      planDetails.limits.maxLlmCostPerMonthUsd !== -1 &&
      usage.llmCostThisMonth >= planDetails.limits.maxLlmCostPerMonthUsd
    ) {
      return {
        allowed: false,
        reason: `Monthly LLM budget exceeded: $${usage.llmCostThisMonth.toFixed(2)}/$${planDetails.limits.maxLlmCostPerMonthUsd}`,
      };
    }

    return { allowed: true };
  }

  async canUseAgent(
    storeId: string,
    agentType: AgentType
  ): Promise<boolean> {
    const plan = await this.subscriptionRepo.getActivePlan(storeId);
    if (!plan) return false;

    const planDetails = getPlan(plan);

    const agentPriority: Record<AgentType, number> = {
      conversion: 0,
      retention: 1,
      support: 2,
      acquisition: 3,
      operations: 4,
    };

    const agentIndex = agentPriority[agentType] ?? 99;
    return agentIndex < planDetails.limits.maxAgents;
  }

  async canUseIntegration(
    storeId: string,
    provider: string
  ): Promise<boolean> {
    const plan = await this.subscriptionRepo.getActivePlan(storeId);
    if (!plan) return provider === 'shopify'; // Shopify always allowed

    const planDetails = getPlan(plan);
    return planDetails.limits.integrations.includes(provider);
  }
}
