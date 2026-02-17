// src/core/agent-os/rate-limiter.ts

import { AgentRunRepo } from '@/data/repositories/agent-run.repo';
import { AgentConfigRepo } from '@/data/repositories/agent-config.repo';
import { AGENT_DEFAULTS } from '@/config/agents.config';
import { logger } from '@/lib/logger';
import type { AgentType } from '@/types/agent';

export class RateLimiter {
  private agentRunRepo: AgentRunRepo;
  private agentConfigRepo: AgentConfigRepo;

  constructor() {
    this.agentRunRepo = new AgentRunRepo();
    this.agentConfigRepo = new AgentConfigRepo();
  }

  async canAct(storeId: string, agentType: AgentType): Promise<boolean> {
    const config = await this.agentConfigRepo.getConfig(storeId, agentType);
    const maxPerHour =
      config?.maxActionsPerHour ??
      AGENT_DEFAULTS[agentType]?.maxActionsPerHour ??
      50;

    const actionsLastHour = await this.agentRunRepo.getActionsInLastHour(
      storeId,
      agentType
    );

    if (actionsLastHour >= maxPerHour) {
      logger.debug('Rate limit reached', {
        storeId,
        agentType,
        actionsLastHour,
        maxPerHour,
      });
      return false;
    }

    return true;
  }
}
