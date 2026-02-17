// src/core/agent-os/budget-guard.ts

import { AgentRunRepo } from '@/data/repositories/agent-run.repo';
import { StoreRepo } from '@/data/repositories/store.repo';
import { AgentConfigRepo } from '@/data/repositories/agent-config.repo';
import { LIMITS } from '@/config/limits.config';
import { logger } from '@/lib/logger';
import type { AgentType } from '@/types/agent';

export class BudgetGuard {
  private agentRunRepo: AgentRunRepo;
  private storeRepo: StoreRepo;
  private agentConfigRepo: AgentConfigRepo;

  constructor() {
    this.agentRunRepo = new AgentRunRepo();
    this.storeRepo = new StoreRepo();
    this.agentConfigRepo = new AgentConfigRepo();
  }

  async canSpend(storeId: string, agentType: AgentType): Promise<boolean> {
    // 1. Check agent-level daily budget
    const agentConfig = await this.agentConfigRepo.getConfig(
      storeId,
      agentType
    );

    if (agentConfig) {
      const todayAgentCost = await this.agentRunRepo.getTodayCost(
        storeId,
        agentType
      );

      if (todayAgentCost >= agentConfig.maxCostPerDayUsd) {
        logger.warn('Agent daily budget exceeded', {
          storeId,
          agentType,
          spent: todayAgentCost,
          limit: agentConfig.maxCostPerDayUsd,
        });
        return false;
      }
    }

    // 2. Check store-level daily budget
    const store = await this.storeRepo.getById(storeId);
    if (store?.settings?.dailyLlmBudgetUsd) {
      const todayTotalCost = await this.agentRunRepo.getTodayCost(storeId);

      if (todayTotalCost >= store.settings.dailyLlmBudgetUsd) {
        logger.warn('Store daily budget exceeded', {
          storeId,
          spent: todayTotalCost,
          limit: store.settings.dailyLlmBudgetUsd,
        });
        return false;
      }
    }

    // 3. Check store-level monthly budget
    if (store?.settings?.monthlyLlmBudgetUsd) {
      const monthCost = await this.agentRunRepo.getMonthCost(storeId);

      if (monthCost >= store.settings.monthlyLlmBudgetUsd) {
        logger.warn('Store monthly budget exceeded', {
          storeId,
          spent: monthCost,
          limit: store.settings.monthlyLlmBudgetUsd,
        });
        return false;
      }
    }

    // 4. Absolute safety limit
    const todayCost = await this.agentRunRepo.getTodayCost(storeId);
    if (todayCost >= LIMITS.ABSOLUTE_MAX_DAILY_LLM_BUDGET_USD) {
      logger.error('Absolute daily budget exceeded', {
        storeId,
        spent: todayCost,
        limit: LIMITS.ABSOLUTE_MAX_DAILY_LLM_BUDGET_USD,
      });
      return false;
    }

    return true;
  }
}
