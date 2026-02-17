// src/config/limits.config.ts

export const LIMITS = {
  // Webhook processing
  WEBHOOK_TIMEOUT_MS: 4500, // Shopify gives 5s, we use 4.5s
  MAX_WEBHOOK_RETRIES: 3,

  // Agent execution
  MAX_AGENT_EXECUTION_MS: 30000, // 30 seconds max per agent run
  MAX_LLM_TOKENS_PER_CALL: 4096,

  // Rate limiting
  MAX_SHOPIFY_API_CALLS_PER_SECOND: 2,
  MAX_AGENT_ACTIONS_PER_MINUTE: 10,

  // Data retention
  PROCESSED_EVENTS_RETENTION_DAYS: 7,
  AGENT_RUNS_RETENTION_DAYS: 90,
  EVENTS_RETENTION_DAYS: 30,

  // Pagination
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 200,

  // Budget
  DEFAULT_DAILY_LLM_BUDGET_USD: 25,
  DEFAULT_MONTHLY_LLM_BUDGET_USD: 500,
  ABSOLUTE_MAX_DAILY_LLM_BUDGET_USD: 100,
} as const;
