// src/core/agents/base-agent.ts

import type { AgentContext } from '@/core/agent-os/context-builder';
import type { AgentType, AgentDecision } from '@/types/agent';
import type { EventType } from '@/types/event';

export interface ExtendedDecision extends AgentDecision {
  tokensUsed?: number;
  costUsd?: number;
}

export abstract class BaseAgent {
  abstract type: AgentType;
  abstract priority: number;
  abstract subscribedEvents: EventType[];

  isEnabled(context: AgentContext): boolean {
    const agentConfig = context.agentConfigs[this.type] as
      | { enabled?: boolean }
      | undefined;
    return agentConfig?.enabled ?? false;
  }

  abstract canHandle(context: AgentContext): boolean;

  abstract decide(context: AgentContext): Promise<ExtendedDecision>;

  abstract execute(
    decision: ExtendedDecision,
    context: AgentContext
  ): Promise<Record<string, unknown>>;
}
