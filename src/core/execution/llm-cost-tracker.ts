// src/core/execution/llm-cost-tracker.ts

import { logger } from '@/lib/logger';

interface CostEntry {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

interface CostSummary {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgDurationMs: number;
  costByModel: Record<string, { calls: number; costUsd: number; tokens: number }>;
}

// In-memory session tracker
// Resets on function cold start (Vercel) — that's fine
// Persistent tracking is in the agent_runs table
const sessionCosts: CostEntry[] = [];
const SESSION_MAX_ENTRIES = 1000;

export class LLMCostTracker {
  async track(entry: CostEntry): Promise<void> {
    // In-memory tracking
    sessionCosts.push(entry);

    if (sessionCosts.length > SESSION_MAX_ENTRIES) {
      sessionCosts.splice(0, Math.floor(SESSION_MAX_ENTRIES * 0.3));
    }

    // Log high-cost calls
    if (entry.costUsd > 0.01) {
      logger.info('High-cost LLM call', {
        model: entry.model,
        tokens: entry.inputTokens + entry.outputTokens,
        costUsd: entry.costUsd.toFixed(6),
        durationMs: entry.durationMs,
      });
    }
  }

  getSessionSummary(): CostSummary {
    const costByModel: Record<
      string,
      { calls: number; costUsd: number; tokens: number }
    > = {};

    let totalCalls = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;
    let totalDurationMs = 0;

    for (const entry of sessionCosts) {
      totalCalls++;
      totalInputTokens += entry.inputTokens;
      totalOutputTokens += entry.outputTokens;
      totalCostUsd += entry.costUsd;
      totalDurationMs += entry.durationMs;

      if (!costByModel[entry.model]) {
        costByModel[entry.model] = { calls: 0, costUsd: 0, tokens: 0 };
      }

      costByModel[entry.model].calls++;
      costByModel[entry.model].costUsd += entry.costUsd;
      costByModel[entry.model].tokens +=
        entry.inputTokens + entry.outputTokens;
    }

    return {
      totalCalls,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd,
      avgDurationMs: totalCalls > 0 ? totalDurationMs / totalCalls : 0,
      costByModel,
    };
  }

  resetSession(): void {
    sessionCosts.length = 0;
  }
}
