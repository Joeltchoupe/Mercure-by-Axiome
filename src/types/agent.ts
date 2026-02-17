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
  tokensUsed?: number;
  costUsd?: number;
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
  status: AgentRunStatus;
  errorMessage?: string;
  createdAt: Date;
}

export type AgentRunStatus = 'success' | 'error' | 'skipped';

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

export interface AgentContext {
  store: import('./store').Store;
  event: import('./event').AgentEvent;
  customer: CustomerContext | null;
  recentEvents: import('./event').AgentEvent[];
  recentOrders: OrderContext[];
  storeAccessToken: string;
  agentConfigs: Record<string, unknown>;
}

export interface CustomerContext {
  id: string | null;
  shopifyId: string | null;
  email: string | null;
  totalOrders: number;
  totalSpent: number;
  daysSinceLastOrder: number | null;
  isRepeatBuyer: boolean;
  tags: string[];
}

export interface OrderContext {
  totalPrice: number;
  createdAt: Date | null;
  lineItems: unknown[];
}

export interface AgentHealthCheck {
  agentType: AgentType;
  enabled: boolean;
  healthy: boolean;
  lastRunAt: Date | null;
  lastError: string | null;
  runsLast24h: number;
  errorsLast24h: number;
  costLast24h: number;
}

export interface AgentDailyStats {
  date: string;
  totalRuns: number;
  totalActions: number;
  successRate: number;
  avgDurationMs: number;
  totalCostUsd: number;
}  successRate: number;
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
