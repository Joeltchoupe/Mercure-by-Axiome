// src/types/agent.ts

export type AgentType =
  | 'conversion'
  | 'retention'
  | 'support'
  | 'acquisition'
  | 'operations';

export interface AgentDecision {
  action: string;
  params: Record<string, unknown>;
  reasoning: string;
  confidence: number;
  estimatedImpact: number;
}

export interface AgentRun {
  id: string;
  storeId: string;
  agentType: AgentType;
  triggerEventId: string;
  context: Record<string, unknown>;
  decision: AgentDecision | null;
  result: Record<string, unknown> | null;
  durationMs: number;
  llmTokensUsed: number;
  costUsd: number;
  status: 'success' | 'error' | 'skipped';
  createdAt: Date;
}

export interface AgentStats {
  agentType: AgentType;
  totalRuns: number;
  totalActions: number;
  successRate: number;
  avgDurationMs: number;
  totalCostUsd: number;
}

export interface AgentConfig {
  id: string;
  storeId: string;
  agentType: AgentType;
  enabled: boolean;
  priority: number;
  maxActionsPerHour: number;
  llmModel: string;
  maxCostPerDayUsd: number;
  config: Record<string, unknown>;
}
