// src/config/agents.config.ts

import type { AgentType } from '@/types/agent';
import type { EventType } from '@/types/event';

export interface AgentDefaultConfig {
  enabled: boolean;
  priority: number;
  maxActionsPerHour: number;
  llmModel: string;
  maxCostPerDayUsd: number;
  description: string;
  subscribedEvents: EventType[];
}

export const AGENT_DEFAULTS: Record<AgentType, AgentDefaultConfig> = {
  conversion: {
    enabled: true,
    priority: 1,
    maxActionsPerHour: 100,
    llmModel: 'gpt-4o-mini',
    maxCostPerDayUsd: 5,
    description:
      'Optimizes conversion rates through dynamic discounts, personalized offers, and checkout optimization.',
    subscribedEvents: [
      'checkout.started',
      'checkout.updated',
      'cart.created',
      'cart.updated',
    ],
  },
  retention: {
    enabled: true,
    priority: 2,
    maxActionsPerHour: 50,
    llmModel: 'gpt-4o-mini',
    maxCostPerDayUsd: 10,
    description:
      'Maximizes customer lifetime value through segmentation, winback campaigns, and loyalty rewards.',
    subscribedEvents: [
      'order.created',
      'order.fulfilled',
      'customer.created',
      'customer.updated',
      'support.ticket.resolved',
    ],
  },
  support: {
    enabled: true,
    priority: 1,
    maxActionsPerHour: 200,
    llmModel: 'gpt-4o-mini',
    maxCostPerDayUsd: 8,
    description:
      'Automates support ticket triage, auto-responds to common questions, and escalates complex issues.',
    subscribedEvents: [
      'support.ticket.created',
      'order.cancelled',
    ],
  },
  acquisition: {
    enabled: false,
    priority: 3,
    maxActionsPerHour: 30,
    llmModel: 'gpt-4o',
    maxCostPerDayUsd: 15,
    description:
      'Optimizes ad spend allocation based on LTV predictions and real-time campaign performance.',
    subscribedEvents: [
      'order.created',
      'customer.created',
    ],
  },
  operations: {
    enabled: false,
    priority: 4,
    maxActionsPerHour: 20,
    llmModel: 'gpt-4o',
    maxCostPerDayUsd: 10,
    description:
      'Manages inventory forecasting, stock alerts, and supply chain optimization.',
    subscribedEvents: [
      'order.created',
      'order.fulfilled',
      'product.updated',
    ],
  },
};

export const AGENT_TYPE_LIST: AgentType[] = [
  'conversion',
  'retention',
  'support',
  'acquisition',
  'operations',
];

export function getAgentDefault(agentType: AgentType): AgentDefaultConfig {
  const config = AGENT_DEFAULTS[agentType];
  if (!config) {
    throw new Error(`Unknown agent type: ${agentType}`);
  }
  return config;
}

export function isValidAgentType(value: string): value is AgentType {
  return AGENT_TYPE_LIST.includes(value as AgentType);
  }
