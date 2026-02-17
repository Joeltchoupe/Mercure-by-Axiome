// src/core/execution/llm-client.ts

import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

interface LLMRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'json' | 'text';
  budget?: number;
}

interface LLMResponse {
  text: string;
  tokensUsed: number;
  costUsd: number;
  model: string;
  durationMs: number;
}

// Cost per 1M tokens (input + output averaged)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'claude-sonnet': { input: 3, output: 15 },
};

const MODEL_FALLBACK_CHAIN = ['gpt-4o-mini', 'gpt-4o'];

export class LLMClient {
  async complete(params: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    let model = params.model ?? 'gpt-4o-mini';

    // Check budget and downgrade if needed
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
