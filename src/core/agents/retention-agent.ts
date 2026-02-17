// src/core/agents/retention-agent.ts

import { BaseAgent, ExtendedDecision } from '@/core/agents/base-agent';
import { AgentContext } from '@/core/agent-os/context-builder';
import { ShopifyClient } from '@/integrations/shopify/client';
import { LLMClient } from '@/core/execution/llm-client';
import { logger } from '@/lib/logger';
import type { AgentType } from '@/types/agent';
import type { EventType } from '@/types/event';

export class RetentionAgent extends BaseAgent {
  type: AgentType = 'retention';
  priority = 2;

  subscribedEvents: EventType[] = [
    'order.created',
    'order.fulfilled',
    'customer.created',
    'customer.updated',
    'support.ticket.resolved',
  ];

  canHandle(context: AgentContext): boolean {
    return context.customer !== null;
  }

  async decide(context: AgentContext): Promise<ExtendedDecision> {
    const { event, customer } = context;

    if (!customer) {
      return this.noAction('No customer context available');
    }

    switch (event.type) {
      case 'order.created':
        return this.handleOrderCreated(context);
      case 'order.fulfilled':
        return this.handleOrderFulfilled(context);
      case 'customer.created':
        return this.handleNewCustomer(context);
      case 'support.ticket.resolved':
        return this.handleTicketResolved(context);
      default:
        return this.noAction('Event type not handled by retention agent');
    }
  }

  private async handleOrderCreated(
    context: AgentContext
  ): Promise<ExtendedDecision> {
    const { customer, event } = context;

    if (!customer) return this.noAction('No customer');

    const orderValue = this.extractOrderValue(event.payload);

    // First-time buyer: plan post-purchase nurture
    if (customer.totalOrders <= 1) {
      return {
        action: 'tag_customer',
        params: {
          tags: ['first-purchase', 'nurture-sequence'],
          orderValue,
          segment: 'new_buyer',
        },
        reasoning: `First purchase (${orderValue}€). Tagging for nurture sequence to drive repeat.`,
        confidence: 0.9,
        estimatedImpact: orderValue * 0.3, // 30% chance of repeat
        tokensUsed: 0,
        costUsd: 0,
      };
    }

    // VIP detection
    if (customer.totalSpent + orderValue > 500 || customer.totalOrders >= 5) {
      return {
        action: 'tag_customer',
        params: {
          tags: ['vip', 'high-value'],
          orderValue,
          segment: 'vip',
          totalLifetimeValue: customer.totalSpent + orderValue,
        },
        reasoning: `Customer LTV reached ${customer.totalSpent + orderValue}€. Tagging as VIP.`,
        confidence: 0.95,
        estimatedImpact: orderValue * 0.5,
        tokensUsed: 0,
        costUsd: 0,
      };
    }

    // Repeat buyer acceleration
    if (customer.isRepeatBuyer && customer.daysSinceLastOrder !== null) {
      const avgDaysBetween = customer.daysSinceLastOrder;

      if (avgDaysBetween < 30) {
        return {
          action: 'tag_customer',
          params: {
            tags: ['active-buyer', 'frequent'],
            segment: 'active',
          },
          reasoning: `Active repeat buyer. Last order was ${avgDaysBetween} days ago. Tagging for loyalty.`,
          confidence: 0.85,
          estimatedImpact: orderValue * 0.4,
          tokensUsed: 0,
          costUsd: 0,
        };
      }
    }

    return this.noAction('Order created but no special retention action needed');
  }

  private async handleOrderFulfilled(
    context: AgentContext
  ): Promise<ExtendedDecision> {
    const { customer } = context;

    if (!customer) return this.noAction('No customer');

    // After fulfillment: schedule review request + cross-sell
    if (customer.totalOrders >= 2) {
      return {
        action: 'schedule_followup',
        params: {
          type: 'review_request',
          delayDays: 7,
          segment: customer.totalOrders >= 5 ? 'vip' : 'repeat',
        },
        reasoning: `Order fulfilled for repeat customer (${customer.totalOrders} orders). Scheduling review request in 7 days.`,
        confidence: 0.8,
        estimatedImpact: 5, // Review value
        tokensUsed: 0,
        costUsd: 0,
      };
    }

    return this.noAction('First order fulfilled — handled by nurture sequence');
  }

  private async handleNewCustomer(
    context: AgentContext
  ): Promise<ExtendedDecision> {
    return {
      action: 'tag_customer',
      params: {
        tags: ['new-customer', 'welcome-sequence'],
        segment: 'new',
      },
      reasoning: 'New customer created. Tagging for welcome sequence.',
      confidence: 0.95,
      estimatedImpact: 0,
      tokensUsed: 0,
      costUsd: 0,
    };
  }

  private async handleTicketResolved(
    context: AgentContext
  ): Promise<ExtendedDecision> {
    const { customer } = context;

    if (!customer) return this.noAction('No customer');

    // If high-value customer had a support issue, send recovery offer
    if (customer.totalSpent > 200) {
      const llmClient = new LLMClient();

      const prompt = `A valuable customer (total spent: ${customer.totalSpent}€, ${customer.totalOrders} orders) just had a support ticket resolved.

Should we send a recovery discount to maintain the relationship?

Consider:
- Customer value: ${customer.totalSpent}€
- Order count: ${customer.totalOrders}
- Days since last order: ${customer.daysSinceLastOrder ?? 'unknown'}

Respond in JSON:
{
  "action": "create_recovery_discount" or "NO_ACTION",
  "discount_percentage": number (5-20),
  "reasoning": "brief explanation",
  "confidence": 0.0 to 1.0
}`;

      try {
        const response = await llmClient.complete({
          prompt,
          model: this.getLLMModel(context),
          maxTokens: 200,
          temperature: 0.3,
          responseFormat: 'json',
        });

        const parsed = JSON.parse(response.text);

        if (parsed.action === 'create_recovery_discount') {
          return {
            action: 'create_discount',
            params: {
              type: 'percentage',
              value: `-${parsed.discount_percentage ?? 10}`,
              reason: 'support_recovery',
              customerId: customer.shopifyId,
            },
            reasoning: parsed.reasoning ?? 'Recovery discount for post-support customer',
            confidence: parsed.confidence ?? 0.7,
            estimatedImpact: customer.totalSpent / customer.totalOrders,
            tokensUsed: response.tokensUsed,
            costUsd: response.costUsd,
          };
        }

        return this.noAction(
          parsed.reasoning ?? 'LLM decided no recovery action needed',
          response.tokensUsed,
          response.costUsd
        );
      } catch (error) {
        logger.error('Retention agent LLM error', { error });
        return this.noAction('LLM call failed');
      }
    }

    return this.noAction('Customer not high-value enough for recovery offer');
  }

  async execute(
    decision: ExtendedDecision,
    context: AgentContext
  ): Promise<Record<string, unknown>> {
    const client = new ShopifyClient(
      context.store.shopifyDomain,
      context.storeAccessToken
    );

    switch (decision.action) {
      case 'tag_customer': {
        // Tag customer in Shopify
        const tags = decision.params.tags as string[];
        const customerId = context.customer?.shopifyId;

        if (customerId) {
          // Note: Shopify customer tag update would go here
          // For now, we log the intent
          return {
            action: 'tag_customer',
            customerId,
            tags,
            segment: decision.params.segment,
          };
        }

        return { action: 'tag_customer', skipped: true, reason: 'no_customer_id' };
      }

      case 'create_discount': {
        const customerId = context.customer?.shopifyId;

        const discount = await client.createDiscount({
          title: `AXIO-RET-${Date.now()}`,
          targetType: 'line_item',
          valueType: 'percentage',
          value: decision.params.value as string,
          customerSelection: customerId ? 'prerequisite' : 'all',
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          usageLimit: 1,
          prerequisiteCustomerIds: customerId ? [customerId] : undefined,
        });

        return {
          action: 'create_discount',
          discountCode: discount.code,
          discountValue: decision.params.value,
          reason: decision.params.reason,
          expiresIn: '7d',
        };
      }

      case 'schedule_followup': {
        // In production, this would create a scheduled task
        return {
          action: 'schedule_followup',
          type: decision.params.type,
          delayDays: decision.params.delayDays,
          scheduled: true,
        };
      }

      default:
        return {};
    }
  }

  private extractOrderValue(payload: Record<string, unknown>): number {
    if (typeof payload.total_price === 'string') {
      return parseFloat(payload.total_price);
    }
    if (typeof payload.total_price === 'number') {
      return payload.total_price;
    }
    return 0;
  }

  private getLLMModel(context: AgentContext): string {
    const config = context.agentConfigs[this.type] as
      | { llmModel?: string }
      | undefined;
    return config?.llmModel ?? 'gpt-4o-mini';
  }

  private noAction(
    reasoning: string,
    tokensUsed = 0,
    costUsd = 0
  ): ExtendedDecision {
    return {
      action: 'NO_ACTION',
      params: {},
      reasoning,
      confidence: 1,
      estimatedImpact: 0,
      tokensUsed,
      costUsd,
    };
  }
}
