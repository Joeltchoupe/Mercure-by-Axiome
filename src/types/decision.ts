// src/types/decision.ts

import type { AgentType } from './agent';

export type DecisionAction =
  // Conversion
  | 'create_discount'
  | 'personalize_page'
  | 'show_popup'
  | 'modify_checkout'
  // Retention
  | 'tag_customer'
  | 'schedule_followup'
  | 'send_email'
  | 'create_loyalty_reward'
  // Support
  | 'auto_respond'
  | 'escalate'
  | 'flag_vip'
  | 'close_ticket'
  // Acquisition
  | 'adjust_budget'
  | 'pause_campaign'
  | 'create_audience'
  // Operations
  | 'reorder_stock'
  | 'flag_low_stock'
  | 'suggest_price_change'
  // Universal
  | 'NO_ACTION';

export interface DecisionLog {
  id: string;
  storeId: string;
  agentType: AgentType;
  action: DecisionAction;
  params: Record<string, unknown>;
  reasoning: string;
  confidence: number;
  estimatedImpact: number;
  actualImpact?: number;
  status: 'pending' | 'executed' | 'failed' | 'reverted';
  executedAt?: Date;
  revertedAt?: Date;
  revertReason?: string;
  createdAt: Date;
}

export interface DecisionOutcome {
  decisionId: string;
  measuredAt: Date;
  revenueImpact: number;
  conversionImpact: number;
  customerSatisfactionImpact: number;
  notes: string;
}

export interface DecisionFilter {
  agentType?: AgentType;
  action?: DecisionAction;
  status?: string;
  minConfidence?: number;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
  }
