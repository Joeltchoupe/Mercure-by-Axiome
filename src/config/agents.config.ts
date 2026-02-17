// src/config/agents.config.ts

import type { AgentType } from '@/types/agent';

interface AgentDefaultConfig {
  enabled: boolean;
  priority: number;
  maxActionsPerHour: number;
  llmModel: string;
  maxCostPerDayUsd: number;
}

export const AGENT_DEFAULTS: Record<AgentType, AgentDefaultConfig> = {
  conversion: {
    enabled: true,
    priority: 1,
    maxActionsPerHour: 100,
    llmModel: 'gpt-4o-mini',
    maxCostPerDayUsd: 5,
  },
  retention: {
    enabled: true,
    priority: 2,
    maxActionsPerHour: 50,
    llmModel: 'gpt-4o-mini',
    maxCostPerDayUsd: 10,
  },
  support: {
    enabled: true,
    priority: 1,
    maxActionsPerHour: 200,
    llmModel: 'gpt-4o-mini',
    maxCostPerDayUsd: 8,
  },
  acquisition: {
    enabled: false,
    priority: 3,
    maxActionsPerHour: 30,
    llmModel: 'gpt-4o',
    maxCostPerDayUsd: 15,
  },
  operations: {
    enabled: false,
    priority: 4,
    maxActionsPerHour: 20,
    llmModel: 'gpt-4o',
    maxCostPerDayUsd: 10,
  },
};
