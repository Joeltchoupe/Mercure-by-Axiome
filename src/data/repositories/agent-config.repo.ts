// src/data/repositories/agent-config.repo.ts

import { db } from '@/data/db';
import { AGENT_DEFAULTS } from '@/config/agents.config';
import type { AgentConfig, AgentType } from '@/types/agent';

interface AgentConfigRow {
  id: string;
  store_id: string;
  agent_type: AgentType;
  enabled: boolean;
  priority: number;
  max_actions_per_hour: number;
  llm_model: string;
  max_cost_per_day_usd: string;
  config: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

function rowToConfig(row: AgentConfigRow): AgentConfig {
  return {
    id: row.id,
    storeId: row.store_id,
    agentType: row.agent_type,
    enabled: row.enabled,
    priority: row.priority,
    maxActionsPerHour: row.max_actions_per_hour,
    llmModel: row.llm_model,
    maxCostPerDayUsd: parseFloat(row.max_cost_per_day_usd),
    config: row.config,
  };
}

export class AgentConfigRepo {
  async getConfig(
    storeId: string,
    agentType: AgentType
  ): Promise<AgentConfig | null> {
    const result = await db.query<AgentConfigRow>(
      'SELECT * FROM agent_configs WHERE store_id = $1 AND agent_type = $2',
      [storeId, agentType]
    );

    if (result.rows.length === 0) return null;
    return rowToConfig(result.rows[0]);
  }

  async getAllConfigs(storeId: string): Promise<AgentConfig[]> {
    const result = await db.query<AgentConfigRow>(
      'SELECT * FROM agent_configs WHERE store_id = $1 ORDER BY priority ASC',
      [storeId]
    );

    return result.rows.map(rowToConfig);
  }

  async getEnabledConfigs(storeId: string): Promise<AgentConfig[]> {
    const result = await db.query<AgentConfigRow>(
      `SELECT * FROM agent_configs
       WHERE store_id = $1 AND enabled = true
       ORDER BY priority ASC`,
      [storeId]
    );

    return result.rows.map(rowToConfig);
  }

  async upsertConfig(
    storeId: string,
    agentType: AgentType,
    updates: Partial<{
      enabled: boolean;
      priority: number;
      maxActionsPerHour: number;
      llmModel: string;
      maxCostPerDayUsd: number;
      config: Record<string, unknown>;
    }>
  ): Promise<AgentConfig> {
    const defaults = AGENT_DEFAULTS[agentType];

    const result = await db.query<AgentConfigRow>(
      `INSERT INTO agent_configs (
        store_id, agent_type, enabled, priority,
        max_actions_per_hour, llm_model, max_cost_per_day_usd, config
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (store_id, agent_type)
      DO UPDATE SET
        enabled = COALESCE($3, agent_configs.enabled),
        priority = COALESCE($4, agent_configs.priority),
        max_actions_per_hour = COALESCE($5, agent_configs.max_actions_per_hour),
        llm_model = COALESCE($6, agent_configs.llm_model),
        max_cost_per_day_usd = COALESCE($7, agent_configs.max_cost_per_day_usd),
        config = agent_configs.config || COALESCE($8, '{}'::jsonb),
        updated_at = NOW()
      RETURNING *`,
      [
        storeId,
        agentType,
        updates.enabled ?? defaults.enabled,
        updates.priority ?? defaults.priority,
        updates.maxActionsPerHour ?? defaults.maxActionsPerHour,
        updates.llmModel ?? defaults.llmModel,
        updates.maxCostPerDayUsd ?? defaults.maxCostPerDayUsd,
        JSON.stringify(updates.config ?? {}),
      ]
    );

    return rowToConfig(result.rows[0]);
  }

  async initializeDefaults(storeId: string): Promise<void> {
    const agentTypes: AgentType[] = [
      'conversion',
      'retention',
      'support',
      'acquisition',
      'operations',
    ];

    for (const agentType of agentTypes) {
      const existing = await this.getConfig(storeId, agentType);
      if (!existing) {
        await this.upsertConfig(storeId, agentType, {});
      }
    }
  }

  async isEnabled(storeId: string, agentType: AgentType): Promise<boolean> {
    const config = await this.getConfig(storeId, agentType);
    return config?.enabled ?? AGENT_DEFAULTS[agentType]?.enabled ?? false;
  }
}
