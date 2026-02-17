// src/core/agents/support-agent.ts

import { BaseAgent, ExtendedDecision } from '@/core/agents/base-agent';
import { AgentContext } from '@/core/agent-os/context-builder';
import { LLMClient } from '@/core/execution/llm-client';
import { logger } from '@/lib/logger';
import type { AgentType } from '@/types/agent';
import type { EventType } from '@/types/event';

export class SupportAgent extends BaseAgent {
  type: AgentType = 'support';
  priority = 1;

  subscribedEvents: EventType[] = [
    'support.ticket.created',
    'order.cancelled',
  ];

  canHandle(context: AgentContext): boolean {
    return true; // Support handles all events it subscribes to
  }

  async decide(context: AgentContext): Promise<ExtendedDecision> {
    const { event, customer } = context;

    switch (event.type) {
      case 'support.ticket.created':
        return this.handleTicketCreated(context);
      case 'order.cancelled':
        return this.handleOrderCancelled(context);
      default:
        return this.noAction('Unhandled event type');
    }
  }

  private async handleTicketCreated(
    context: AgentContext
  ): Promise<ExtendedDecision> {
    const { event, customer, recentOrders } = context;

    const ticketSubject = (event.payload.subject as string) ?? '';
    const ticketBody = (event.payload.body as string) ?? '';
    const ticketContent = `${ticketSubject}\n${ticketBody}`.toLowerCase();

    // Fast path: common questions
    if (this.isTrackingQuestion(ticketContent)) {
      return {
        action: 'auto_respond',
        params: {
          responseType: 'tracking_info',
          template: 'tracking',
        },
        reasoning: 'Customer asking about order tracking. Auto-responding with tracking info.',
        confidence: 0.9,
        estimatedImpact: 0,
        tokensUsed: 0,
        costUsd: 0,
      };
    }

    if (this.isReturnQuestion(ticketContent)) {
      return {
        action: 'auto_respond',
        params: {
          responseType: 'return_info',
          template: 'returns',
        },
        reasoning: 'Customer asking about returns. Auto-responding with return policy.',
        confidence: 0.85,
        estimatedImpact: 0,
        tokensUsed: 0,
        costUsd: 0,
      };
    }

    // Complex ticket: use LLM to classify and decide
    const llmClient = new LLMClient();

    const prompt = `You are a customer support triage agent. Classify this support ticket and decide the best action.

Ticket:
Subject: ${ticketSubject}
Body: ${ticketBody}

Customer info:
- Total orders: ${customer?.totalOrders ?? 'unknown'}
- Total spent: ${customer?.totalSpent ?? 'unknown'}€
- Is VIP (spent > 500€): ${(customer?.totalSpent ?? 0) > 500}

Recent orders: ${recentOrders.length}

Classify into:
1. "auto_respond" — can be answered automatically
2. "escalate" — needs human attention
3. "flag_vip" — VIP customer needs priority human attention

Respond in JSON:
{
  "action": "auto_respond" or "escalate" or "flag_vip",
  "category": "tracking" or "returns" or "product_question" or "complaint" or "other",
  "urgency": "low" or "medium" or "high",
  "suggested_response": "brief response if auto_respond",
  "reasoning": "brief explanation",
  "confidence": 0.0 to 1.0
}`;

    try {
      const response = await llmClient.complete({
        prompt,
        model: this.getLLMModel(context),
        maxTokens: 300,
        temperature: 0.2,
        responseFormat: 'json',
      });

      const parsed = JSON.parse(response.text);

      return {
        action: parsed.action,
        params: {
          category: parsed.category,
          urgency: parsed.urgency,
          suggestedResponse: parsed.suggested_response,
          isVip: (customer?.totalSpent ?? 0) > 500,
        },
        reasoning: parsed.reasoning ?? 'LLM triage decision',
        confidence: parsed.confidence ?? 0.6,
        estimatedImpact: 0,
        tokensUsed: response.tokensUsed,
        costUsd: response.costUsd,
      };
    } catch (error) {
      logger.error('Support agent LLM error', { error });

      // Fallback: escalate to human
      return {
        action: 'escalate',
        params: {
          category: 'unknown',
          urgency: 'medium',
          reason: 'LLM classification failed',
        },
        reasoning: 'LLM call failed. Escalating to human as safety measure.',
        confidence: 0.5,
        estimatedImpact: 0,
        tokensUsed: 0,
        costUsd: 0,
      };
    }
  }

  private async handleOrderCancelled(
    context: AgentContext
  ): Promise<ExtendedDecision> {
    const { customer, event } = context;

    if (!customer) return this.noAction('No customer context for cancellation');

    // High-value customer cancelled: flag for follow-up
    if (customer.totalSpent > 200) {
      return {
        action: 'flag_vip',
        params: {
          reason: 'order_cancelled',
          urgency: 'high',
          customerValue: customer.totalSpent,
          orderId: event.payload.id,
        },
        reasoning: `High-value customer (${customer.totalSpent}€) cancelled order. Flagging for personal follow-up.`,
        confidence: 0.9,
        estimatedImpact: customer.totalSpent / customer.totalOrders,
        tokensUsed: 0,
        costUsd: 0,
      };
    }

    return {
      action: 'tag_customer',
      params: {
        tags: ['cancelled-order'],
        reason: 'order_cancelled',
      },
      reasoning: 'Order cancelled. Tagging customer for winback sequence.',
      confidence: 0.85,
      estimatedImpact: 0,
      tokensUsed: 0,
      costUsd: 0,
    };
  }

  async execute(
    decision: ExtendedDecision,
    context: AgentContext
  ): Promise<Record<string, unknown>> {
    switch (decision.action) {
      case 'auto_respond': {
        // In production: send response via Gorgias API
        return {
          action: 'auto_respond',
          responseType: decision.params.responseType,
          sent: true,
        };
      }

      case 'escalate': {
        // In production: create high-priority ticket in Gorgias
        return {
          action: 'escalate',
          category: decision.params.category,
          urgency: decision.params.urgency,
          escalated: true,
        };
      }

      case 'flag_vip': {
        // In production: notify team via Slack/email
        return {
          action: 'flag_vip',
          reason: decision.params.reason,
          customerValue: decision.params.customerValue,
          flagged: true,
        };
      }

      case 'tag_customer': {
        return {
          action: 'tag_customer',
          tags: decision.params.tags,
          tagged: true,
        };
      }

      default:
        return {};
    }
  }

  private isTrackingQuestion(content: string): boolean {
    const trackingKeywords = [
      'tracking',
      'track',
      'where is my order',
      'où est ma commande',
      'suivi',
      'livraison',
      'delivery',
      'shipped',
      'colis',
      'package',
    ];
    return trackingKeywords.some((kw) => content.includes(kw));
  }

  private isReturnQuestion(content: string): boolean {
    const returnKeywords = [
      'return',
      'retour',
      'refund',
      'remboursement',
      'exchange',
      'échanger',
      'renvoi',
      'send back',
    ];
    return returnKeywords.some((kw) => content.includes(kw));
  }

  private getLLMModel(context: AgentContext): string {
    const config = context.agentConfigs[this.type] as
      | { llmModel?: string }
      | undefined;
    return config?.llmModel ?? 'gpt-4o-mini';
  }

  private noAction(reasoning: string): ExtendedDecision {
    return {
      action: 'NO_ACTION',
      params: {},
      reasoning,
      confidence: 1,
      estimatedImpact: 0,
      tokensUsed: 0,
      costUsd: 0,
    };
  }
}
