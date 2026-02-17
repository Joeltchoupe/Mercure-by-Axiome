// src/core/agents/conversion-agent.ts

import { BaseAgent, ExtendedDecision } from '@/core/agents/base-agent';
import { AgentContext } from '@/core/agent-os/context-builder';
import { ShopifyClient } from '@/integrations/shopify/client';
import { LLMClient } from '@/core/execution/llm-client';
import { logger } from '@/lib/logger';
import type { AgentType } from '@/types/agent';
import type { EventType } from '@/types/event';

export class ConversionAgent extends BaseAgent {
  type: AgentType = 'conversion';
  priority = 1;

  subscribedEvents: EventType[] = [
    'checkout.started',
    'checkout.updated',
    'cart.created',
    'cart.updated',
  ];

  canHandle(context: AgentContext): boolean {
    // Only handle if we have customer info
    const hasCustomerInfo =
      context.customer !== null ||
      context.event.payload.email !== undefined;

    return hasCustomerInfo;
  }

  async decide(context: AgentContext): Promise<ExtendedDecision> {
    const { event, customer, recentOrders } = context;

    // Rule-based fast path — no LLM needed for simple cases
    if (event.type === 'cart.updated' || event.type === 'cart.created') {
      return this.handleCartEvent(context);
    }

    if (event.type === 'checkout.started') {
      return this.handleCheckoutStarted(context);
    }

    return {
      action: 'NO_ACTION',
      params: {},
      reasoning: 'Event type not actionable for conversion agent',
      confidence: 1,
      estimatedImpact: 0,
      tokensUsed: 0,
      costUsd: 0,
    };
  }

  private async handleCartEvent(
    context: AgentContext
  ): Promise<ExtendedDecision> {
    const { customer, event } = context;
    const cartValue = this.extractCartValue(event.payload);

    // High-value cart from new customer — offer incentive
    if (!customer?.isRepeatBuyer && cartValue > 100) {
      return {
        action: 'create_discount',
        params: {
          type: 'percentage',
          value: '-10',
          reason: 'high_value_new_customer',
          cartValue,
        },
        reasoning: `New customer with high-value cart (${cartValue}€). Offering 10% to convert.`,
        confidence: 0.75,
        estimatedImpact: cartValue * 0.9,
        tokensUsed: 0,
        costUsd: 0,
      };
    }

    // Repeat buyer with higher than average cart — no discount needed
    if (customer?.isRepeatBuyer && cartValue > customer.totalSpent / customer.totalOrders) {
      return {
        action: 'NO_ACTION',
        params: {},
        reasoning: 'Repeat buyer already spending above average. No incentive needed.',
        confidence: 0.85,
        estimatedImpact: 0,
        tokensUsed: 0,
        costUsd: 0,
      };
    }

    return {
      action: 'NO_ACTION',
      params: {},
      reasoning: 'Cart does not meet criteria for conversion intervention.',
      confidence: 0.8,
      estimatedImpact: 0,
      tokensUsed: 0,
      costUsd: 0,
    };
  }

  private async handleCheckoutStarted(
    context: AgentContext
  ): Promise<ExtendedDecision> {
    const { customer, event } = context;
    const checkoutValue = this.extractCheckoutValue(event.payload);

    // Use LLM for complex decision
    const llmClient = new LLMClient();

    const prompt = `You are a conversion optimization agent for an e-commerce store.

A customer has started checkout. Analyze and decide the best action.

Customer profile:
- Is repeat buyer: ${customer?.isRepeatBuyer ?? 'unknown'}
- Total orders: ${customer?.totalOrders ?? 0}
- Total spent: ${customer?.totalSpent ?? 0}€
- Days since last order: ${customer?.daysSinceLastOrder ?? 'N/A'}

Checkout value: ${checkoutValue}€

Decide ONE action:
1. "create_discount" — offer a discount to increase conversion (specify percentage)
2. "NO_ACTION" — let the checkout proceed normally

Respond in JSON:
{
  "action": "create_discount" or "NO_ACTION",
  "discount_percentage": number (if applicable),
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

      return {
        action: parsed.action === 'create_discount' ? 'create_discount' : 'NO_ACTION',
        params: {
          type: 'percentage',
          value: parsed.discount_percentage
            ? `-${parsed.discount_percentage}`
            : undefined,
          reason: 'checkout_optimization',
          checkoutValue,
        },
        reasoning: parsed.reasoning ?? 'LLM decision',
        confidence: parsed.confidence ?? 0.5,
        estimatedImpact:
          parsed.action === 'create_discount'
            ? checkoutValue * (1 - (parsed.discount_percentage ?? 10) / 100)
            : 0,
        tokensUsed: response.tokensUsed,
        costUsd: response.costUsd,
      };
    } catch (error) {
      logger.error('Conversion agent LLM error', { error });

      // Fallback: rule-based
      return {
        action: 'NO_ACTION',
        params: {},
        reasoning: 'LLM call failed, defaulting to no action',
        confidence: 0.5,
        estimatedImpact: 0,
        tokensUsed: 0,
        costUsd: 0,
      };
    }
  }

  async execute(
    decision: ExtendedDecision,
    context: AgentContext
  ): Promise<Record<string, unknown>> {
    if (decision.action === 'create_discount') {
      const client = new ShopifyClient(
        context.store.shopifyDomain,
        context.storeAccessToken
      );

      const customerEmail = context.customer?.email;
      const shopifyCustomerId = context.customer?.shopifyId;

      const discount = await client.createDiscount({
        title: `AXIO-CONV-${Date.now()}`,
        targetType: 'line_item',
        valueType: decision.params.type as 'percentage' | 'fixed_amount',
        value: decision.params.value as string,
        customerSelection: shopifyCustomerId ? 'prerequisite' : 'all',
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        usageLimit: 1,
        prerequisiteCustomerIds: shopifyCustomerId
          ? [shopifyCustomerId]
          : undefined,
      });

      return {
        discountCode: discount.code,
        discountValue: decision.params.value,
        targetCustomer: customerEmail,
        expiresIn: '24h',
      };
    }

    return {};
  }

  private extractCartValue(payload: Record<string, unknown>): number {
    if (typeof payload.total_price === 'string') {
      return parseFloat(payload.total_price);
    }
    if (typeof payload.total_price === 'number') {
      return payload.total_price;
    }
    if (typeof payload.subtotal_price === 'string') {
      return parseFloat(payload.subtotal_price);
    }
    return 0;
  }

  private extractCheckoutValue(payload: Record<string, unknown>): number {
    return this.extractCartValue(payload);
  }

  private getLLMModel(context: AgentContext): string {
    const config = context.agentConfigs[this.type] as
      | { llmModel?: string }
      | undefined;
    return config?.llmModel ?? 'gpt-4o-mini';
  }
}
