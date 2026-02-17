// src/core/agent-os/agent-registry.ts

import { ConversionAgent } from '@/core/agents/conversion-agent';
import { RetentionAgent } from '@/core/agents/retention-agent';
import { SupportAgent } from '@/core/agents/support-agent';
import type { BaseAgent } from '@/core/agents/base-agent';
import type { EventType } from '@/types/event';

export class AgentRegistry {
  private agents: BaseAgent[];

  constructor() {
    this.agents = [
      new ConversionAgent(),
      new RetentionAgent(),
      new SupportAgent(),
    ];
  }

  getAgentsForEvent(eventType: EventType): BaseAgent[] {
    return this.agents
      .filter((agent) => agent.subscribedEvents.includes(eventType))
      .sort((a, b) => a.priority - b.priority);
  }

  getAllAgents(): BaseAgent[] {
    return [...this.agents];
  }

  getAgent(type: string): BaseAgent | undefined {
    return this.agents.find((a) => a.type === type);
  }
}
