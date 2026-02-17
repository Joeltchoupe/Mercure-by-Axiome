// src/core/execution/llm-client.ts

import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import { LLMCostTracker } from '@/core/execution/llm-cost-tracker';

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'json' | 'text';
  budget?: number;
  timeout?: number;
}

export interface LLMResponse {
  text: string;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
  durationMs: number;
  cached: boolean;
}

// Cost per 1M tokens
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'claude-sonnet': { input: 3, output: 15 },
  'claude-haiku': { input: 0.25, output: 1.25 },
};

const MODEL_FALLBACK: Record<string, string> = {
  'gpt-4o': 'gpt-4o-mini',
  'gpt-4-turbo': 'gpt-4o',
  'claude-sonnet': 'gpt-4o-mini',
  'claude-haiku': 'gpt-4o-mini',
};

export class LLMClient {
  private costTracker: LLMCostTracker;

  constructor() {
    this.costTracker = new LLMCostTracker();
  }

  async complete(params: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    let model = params.model ?? 'gpt-4o-mini';
    const timeout = params.timeout ?? 30_000;

    // Budget check and potential model downgrade
    if (params.budget) {
      const estimatedInputTokens = Math.ceil(
        (params.prompt.length + (params.systemPrompt?.length ?? 0)) / 4
      );
      const estimatedCost = this.estimateCost(
        model,
        estimatedInputTokens,
        params.maxTokens ?? 500
      );

      if (estimatedCost > params.budget) {
        const cheaper = this.getCheaperModel(model);
        if (cheaper) {
          logger.debug('Model downgrade for budget', {
            from: model,
            to: cheaper,
            estimatedCost,
            budget: params.budget,
          });
          model = cheaper;
        }
      }
    }

    // Route to provider with retry
    let lastError: Error | null = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        let response: LLMResponse;

        if (model.startsWith('claude')) {
          response = await this.callAnthropic(model, params, startTime, controller.signal);
        } else {
          response = await this.callOpenAI(model, params, startTime, controller.signal);
        }

        clearTimeout(timeoutId);

        // Track cost
        await this.costTracker.track({
          model: response.model,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          costUsd: response.costUsd,
          durationMs: response.durationMs,
        });

        return response;
      } catch (error) {
        lastError = error as Error;

        if ((error as Error).name === 'AbortError') {
          logger.warn('LLM call timed out', { model, timeout, attempt });
        } else {
          logger.warn('LLM call failed, retrying', {
            model,
            attempt,
            error: (error as Error).message,
          });
        }

        // On failure, try cheaper model
        if (attempt < maxRetries) {
          const fallback = this.getCheaperModel(model);
          if (fallback && fallback !== model) {
            model = fallback;
            logger.info('Falling back to cheaper model', { model });
          }

          // Wait before retry
          await sleep(Math.pow(2, attempt) * 500);
        }
      }
    }

    throw lastError ?? new Error('LLM call failed after retries');
  }

  private async callOpenAI(
    model: string,
    params: LLMRequest,
    startTime: number,
    signal: AbortSignal
  ): Promise<LLMResponse> {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const messages: Array<{ role: string; content: string }> = [];

    if (params.systemPrompt) {
      messages.push({ role: 'system', content: params.systemPrompt });
    }

    messages.push({ role: 'user', content: params.prompt });

    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: params.maxTokens ?? 500,
      temperature: params.temperature ?? 0.3,
    };

    if (params.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();

      // Rate limited
      if (response.status === 429) {
        const retryAfter = parseFloat(
          response.headers.get('retry-after') ?? '5'
        );
        await sleep(retryAfter * 1000);
        throw new Error(`OpenAI rate limited, retry after ${retryAfter}s`);
      }

      throw new Error(
        `OpenAI API error ${response.status}: ${errorBody.substring(0, 200)}`
      );
    }

    const data = await response.json();
    const durationMs = Date.now() - startTime;

    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;
    const costs = MODEL_COSTS[model] ?? MODEL_COSTS['gpt-4o-mini'];
    const costUsd =
      (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;

    return {
      text: data.choices?.[0]?.message?.content ?? '',
      tokensUsed: inputTokens + outputTokens,
      inputTokens,
      outputTokens,
      costUsd,
      model,
      durationMs,
      cached: data.usage?.prompt_tokens_details?.cached_tokens > 0,
    };
  }

  private async callAnthropic(
    model: string,
    params: LLMRequest,
    startTime: number,
    signal: AbortSignal
  ): Promise<LLMResponse> {
    const apiKey = env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      logger.warn('ANTHROPIC_API_KEY not configured, falling back to OpenAI');
      return this.callOpenAI('gpt-4o', params, startTime, signal);
    }

    const anthropicModel = resolveAnthropicModel(model);

    const body: Record<string, unknown> = {
      model: anthropicModel,
      max_tokens: params.maxTokens ?? 500,
      temperature: params.temperature ?? 0.3,
      messages: [{ role: 'user', content: params.prompt }],
    };

    if (params.systemPrompt) {
      body.system = params.systemPrompt;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();

      if (response.status === 429) {
        const retryAfter = parseFloat(
          response.headers.get('retry-after') ?? '5'
        );
        await sleep(retryAfter * 1000);
        throw new Error(`Anthropic rate limited, retry after ${retryAfter}s`);
      }

      throw new Error(
        `Anthropic API error ${response.status}: ${errorBody.substring(0, 200)}`
      );
    }

    const data = await response.json();
    const durationMs = Date.now() - startTime;

    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const costs = MODEL_COSTS[model] ?? MODEL_COSTS['claude-sonnet'];
    const costUsd =
      (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;

    const text =
      data.content?.[0]?.type === 'text' ? data.content[0].text : '';

    return {
      text,
      tokensUsed: inputTokens + outputTokens,
      inputTokens,
      outputTokens,
      costUsd,
      model,
      durationMs,
      cached: (data.usage?.cache_read_input_tokens ?? 0) > 0,
    };
  }

  estimateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const costs = MODEL_COSTS[model] ?? MODEL_COSTS['gpt-4o-mini'];
    return (
      (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000
    );
  }

  getCheaperModel(model: string): string | null {
    return MODEL_FALLBACK[model] ?? null;
  }

  getAvailableModels(): string[] {
    const models: string[] = [];
    if (env.OPENAI_API_KEY) {
      models.push('gpt-4o-mini', 'gpt-4o');
    }
    if (env.ANTHROPIC_API_KEY) {
      models.push('claude-sonnet', 'claude-haiku');
    }
    return models;
  }
}

// ─── Helpers ───

function resolveAnthropicModel(model: string): string {
  const mapping: Record<string, string> = {
    'claude-sonnet': 'claude-sonnet-4-20250514',
    'claude-haiku': 'claude-haiku-3-20240307',
  };
  return mapping[model] ?? model;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
      }    // Check budget and downgrade if needed
    if (params.budget) {
      const estimatedCost = this.estimateCost(
        model,
        params.prompt.length / 4,
        params.maxTokens ?? 500
      );

      if (estimatedCost > params.budget) {
        const cheaperModel = this.getCheaperModel(model);
        if (cheaperModel) {
          logger.debug('Downgrading model for budget', {
            from: model,
            to: cheaperModel,
            estimatedCost,
            budget: params.budget,
          });
          model = cheaperModel;
        }
      }
    }

    // Route to provider
    if (model.startsWith('claude')) {
      return this.callAnthropic(model, params, startTime);
    }

    return this.callOpenAI(model, params, startTime);
  }

  private async callOpenAI(
    model: string,
    params: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const apiKey = env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const body: Record<string, unknown> = {
      model,
      messages: [{ role: 'user', content: params.prompt }],
      max_tokens: params.maxTokens ?? 500,
      temperature: params.temperature ?? 0.3,
    };

    if (params.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('OpenAI API error', {
        status: response.status,
        body: errorBody,
        model,
      });
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const durationMs = Date.now() - startTime;

    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;
    const totalTokens = inputTokens + outputTokens;

    const costs = MODEL_COSTS[model] ?? MODEL_COSTS['gpt-4o-mini'];
    const costUsd =
      (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;

    return {
      text: data.choices[0]?.message?.content ?? '',
      tokensUsed: totalTokens,
      costUsd,
      model,
      durationMs,
    };
  }

  private async callAnthropic(
    model: string,
    params: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const apiKey = env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      // Fallback to OpenAI
      logger.warn('Anthropic API key not configured, falling back to OpenAI');
      return this.callOpenAI('gpt-4o', params, startTime);
    }

    const anthropicModel =
      model === 'claude-sonnet'
        ? 'claude-sonnet-4-20250514'
        : 'claude-sonnet-4-20250514';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: anthropicModel,
        max_tokens: params.maxTokens ?? 500,
        temperature: params.temperature ?? 0.3,
        messages: [{ role: 'user', content: params.prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Anthropic API error', {
        status: response.status,
        body: errorBody,
      });
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const durationMs = Date.now() - startTime;

    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const totalTokens = inputTokens + outputTokens;

    const costs = MODEL_COSTS['claude-sonnet'];
    const costUsd =
      (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;

    const text =
      data.content?.[0]?.type === 'text' ? data.content[0].text : '';

    return {
      text,
      tokensUsed: totalTokens,
      costUsd,
      model,
      durationMs,
    };
  }

  private estimateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const costs = MODEL_COSTS[model] ?? MODEL_COSTS['gpt-4o-mini'];
    return (
      (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000
    );
  }

  private getCheaperModel(model: string): string | null {
    const index = MODEL_FALLBACK_CHAIN.indexOf(model);
    if (index > 0) {
      return MODEL_FALLBACK_CHAIN[index - 1];
    }
    if (model === 'claude-sonnet') {
      return 'gpt-4o-mini';
    }
    return null;
  }
}
