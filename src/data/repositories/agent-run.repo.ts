// src/data/repositories/agent-run.repo.ts

import { db } from '@/data/db';
import type { AgentRun, AgentStats, AgentType, AgentDecision } from '@/types/agent';

interface AgentRunRow {
  id: string;
  store_id: string;
  agent_type: AgentType;
  trigger_event_id: string;
  context: Record<string, unknown>;
  decision: AgentDecision | null;
  result: Record<string, unknown> | null;
  duration_ms: number | null;
  llm_tokens_used: number;
  cost_usd: string;
  status: 'success' | 'error' | 'skipped';
  error_message: string | null;
  created_at: Date;
}

function rowToAgentRun(row: AgentRunRow): AgentRun {
  return {
    id: row.id,
    storeId: row.store_id,
    agentType: row.agent_type,
    triggerEventId: row.trigger_event_id,
    context: row.context,
    decision: row.decision,
    result: row.result,
    durationMs: row.duration_ms ?? 0,
    llmTokensUsed: row.llm_tokens_used,
    costUsd: parseFloat(row.cost_usd),
    status: row.status,
    createdAt: row.created_at,
  };
}

export class AgentRunRepo {
  async create(params: {
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
    errorMessage?: string;
  }): Promise<AgentRun> {
    const result = await db.query<AgentRunRow>(
      `INSERT INTO agent_runs (
        store_id, agent_type, trigger_event_id, context,
        decision, result, duration_ms, llm_tokens_used,
        cost_usd, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        params.storeId,
        params.agentType,
        params.triggerEventId,
        JSON.stringify(params.context),
        params.decision ? JSON.stringify(params.decision) : null,
        params.result ? JSON.stringify(params.result) : null,
        params.durationMs,
        params.llmTokensUsed,
        params.costUsd,
        params.status,
        params.errorMessage ?? null,
      ]
    );

    return rowToAgentRun(result.rows[0]);
  }

  async getById(storeId: string, id: string): Promise<AgentRun | null> {
    const result = await db.query<AgentRunRow>(
      'SELECT * FROM agent_runs WHERE id = $1 AND store_id = $2',
      [id, storeId]
    );

    if (result.rows.length === 0) return null;
    return rowToAgentRun(result.rows[0]);
  }

  async getRecentRuns(
    storeId: string,
    params?: {
      limit?: number;
      offset?: number;
      since?: Date;
      agentType?: string;
      status?: string;
    }
  ): Promise<AgentRun[]> {
    const conditions = ['store_id = $1'];
    const values: unknown[] = [storeId];
    let paramIndex = 2;

    if (params?.since) {
      conditions.push(`created_at >= $${paramIndex}`);
      values.push(params.since);
      paramIndex++;
    }

    if (params?.agentType) {
      conditions.push(`agent_type = $${paramIndex}`);
      values.push(params.agentType);
      paramIndex++;
    }

    if (params?.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(params.status);
      paramIndex++;
    }

    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;

    const result = await db.query<AgentRunRow>(
      `SELECT * FROM agent_runs
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return result.rows.map(rowToAgentRun);
  }

  async countRuns(
    storeId: string,
    params?: { agentType?: string; status?: string }
  ): Promise<number> {
    const conditions = ['store_id = $1'];
    const values: unknown[] = [storeId];
    let paramIndex = 2;

    if (params?.agentType) {
      conditions.push(`agent_type = $${paramIndex}`);
      values.push(params.agentType);
      paramIndex++;
    }

    if (params?.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(params.status);
      paramIndex++;
    }

    const result = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM agent_runs
       WHERE ${conditions.join(' AND ')}`,
      values
    );

    return parseInt(result.rows[0].count, 10);
  }

  async getAgentStats(
    storeId: string,
    startDate: Date,
    endDate: Date,
    agentType?: AgentType
  ): Promise<AgentStats | Record<AgentType, AgentStats>> {
    const conditions = ['store_id = $1', 'created_at >= $2', 'created_at < $3'];
    const values: unknown[] = [storeId, startDate, endDate];
    let paramIndex = 4;

    if (agentType) {
      conditions.push(`agent_type = $${paramIndex}`);
      values.push(agentType);
    }

    const result = await db.query<{
      agent_type: AgentType;
      total_runs: string;
      total_actions: string;
      success_count: string;
      avg_duration_ms: string;
      total_cost_usd: string;
    }>(
      `SELECT
         agent_type,
         COUNT(*) as total_runs,
         COUNT(*) FILTER (
           WHERE decision IS NOT NULL
             AND decision->>'action' != 'NO_ACTION'
         ) as total_actions,
         COUNT(*) FILTER (WHERE status = 'success') as success_count,
         COALESCE(AVG(duration_ms), 0) as avg_duration_ms,
         COALESCE(SUM(cost_usd), 0) as total_cost_usd
       FROM agent_runs
       WHERE ${conditions.join(' AND ')}
       GROUP BY agent_type`,
      values
    );

    if (agentType) {
      const row = result.rows[0];
      if (!row) {
        return {
          agentType,
          totalRuns: 0,
          totalActions: 0,
          successRate: 0,
          avgDurationMs: 0,
          totalCostUsd: 0,
        };
      }

      const totalRuns = parseInt(row.total_runs, 10);
      const successCount = parseInt(row.success_count, 10);

      return {
        agentType: row.agent_type,
        totalRuns,
        totalActions: parseInt(row.total_actions, 10),
        successRate: totalRuns > 0 ? (successCount / totalRuns) * 100 : 0,
        avgDurationMs: parseFloat(row.avg_duration_ms),
        totalCostUsd: parseFloat(row.total_cost_usd),
      };
    }

    // Return all agents
    const statsMap: Record<string, AgentStats> = {};

    for (const row of result.rows) {
      const totalRuns = parseInt(row.total_runs, 10);
      const successCount = parseInt(row.success_count, 10);

      statsMap[row.agent_type] = {
        agentType: row.agent_type,
        totalRuns,
        totalActions: parseInt(row.total_actions, 10),
        successRate: totalRuns > 0 ? (successCount / totalRuns) * 100 : 0,
        avgDurationMs: parseFloat(row.avg_duration_ms),
        totalCostUsd: parseFloat(row.total_cost_usd),
      };
    }

    return statsMap as Record<AgentType, AgentStats>;
  }

  async getDailyAgentStats(
    storeId: string,
    agentType: AgentType,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      date: string;
      totalRuns: number;
      totalActions: number;
      successRate: number;
      avgDurationMs: number;
    }>
  > {
    const result = await db.query<{
      date: string;
      total_runs: string;
      total_actions: string;
      success_count: string;
      avg_duration_ms: string;
    }>(
      `SELECT
         DATE(created_at) as date,
         COUNT(*) as total_runs,
         COUNT(*) FILTER (
           WHERE decision IS NOT NULL
             AND decision->>'action' != 'NO_ACTION'
         ) as total_actions,
         COUNT(*) FILTER (WHERE status = 'success') as success_count,
         COALESCE(AVG(duration_ms), 0) as avg_duration_ms
       FROM agent_runs
       WHERE store_id = $1
         AND agent_type = $2
         AND created_at >= $3
         AND created_at < $4
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [storeId, agentType, startDate, endDate]
    );

    return result.rows.map((row) => {
      const totalRuns = parseInt(row.total_runs, 10);
      const successCount = parseInt(row.success_count, 10);

      return {
        date: row.date,
        totalRuns,
        totalActions: parseInt(row.total_actions, 10),
        successRate: totalRuns > 0 ? (successCount / totalRuns) * 100 : 0,
        avgDurationMs: parseFloat(row.avg_duration_ms),
      };
    });
  }

  async getTodayCost(storeId: string, agentType?: AgentType): Promise<number> {
    const conditions = [
      'store_id = $1',
      "created_at >= date_trunc('day', NOW())",
    ];
    const values: unknown[] = [storeId];

    if (agentType) {
      conditions.push('agent_type = $2');
      values.push(agentType);
    }

    const result = await db.query<{ total_cost: string }>(
      `SELECT COALESCE(SUM(cost_usd), 0) as total_cost
       FROM agent_runs
       WHERE ${conditions.join(' AND ')}`,
      values
    );

    return parseFloat(result.rows[0].total_cost);
  }

  async getMonthCost(storeId: string): Promise<number> {
    const result = await db.query<{ total_cost: string }>(
      `SELECT COALESCE(SUM(cost_usd), 0) as total_cost
       FROM agent_runs
       WHERE store_id = $1
         AND created_at >= date_trunc('month', NOW())`,
      [storeId]
    );

    return parseFloat(result.rows[0].total_cost);
  }

  async getActionsInLastHour(
    storeId: string,
    agentType: AgentType
  ): Promise<number> {
    const result = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM agent_runs
       WHERE store_id = $1
         AND agent_type = $2
         AND created_at >= NOW() - INTERVAL '1 hour'
         AND decision IS NOT NULL
         AND decision->>'action' != 'NO_ACTION'`,
      [storeId, agentType]
    );

    return parseInt(result.rows[0].count, 10);
  }

  async cleanupOldRuns(retentionDays: number): Promise<number> {
    const result = await db.query(
      `DELETE FROM agent_runs
       WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
      [retentionDays]
    );

    return result.rowCount ?? 0;
  }
    }
