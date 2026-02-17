// src/config/llm.config.ts

export interface LLMModelConfig {
  id: string;
  provider: 'openai' | 'anthropic';
  label: string;
  description: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  maxContextTokens: number;
  maxOutputTokens: number;
  supportsJson: boolean;
  supportsStreaming: boolean;
  tier: 'cheap' | 'balanced' | 'premium';
  apiModel: string;
}

export const LLM_MODELS: Record<string, LLMModelConfig> = {
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    provider: 'openai',
    label: 'GPT-4o Mini',
    description: 'Fast and cheap. Best for high-volume, simple decisions.',
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    maxContextTokens: 128_000,
    maxOutputTokens: 16_384,
    supportsJson: true,
    supportsStreaming: true,
    tier: 'cheap',
    apiModel: 'gpt-4o-mini',
  },
  'gpt-4o': {
    id: 'gpt-4o',
    provider: 'openai',
    label: 'GPT-4o',
    description: 'Balanced performance and cost. Good for complex reasoning.',
    inputCostPer1M: 2.5,
    outputCostPer1M: 10,
    maxContextTokens: 128_000,
    maxOutputTokens: 16_384,
    supportsJson: true,
    supportsStreaming: true,
    tier: 'balanced',
    apiModel: 'gpt-4o',
  },
  'claude-sonnet': {
    id: 'claude-sonnet',
    provider: 'anthropic',
    label: 'Claude Sonnet',
    description: 'Strong reasoning. Best for nuanced customer interactions.',
    inputCostPer1M: 3,
    outputCostPer1M: 15,
    maxContextTokens: 200_000,
    maxOutputTokens: 8_192,
    supportsJson: false,
    supportsStreaming: true,
    tier: 'balanced',
    apiModel: 'claude-sonnet-4-20250514',
  },
  'claude-haiku': {
    id: 'claude-haiku',
    provider: 'anthropic',
    label: 'Claude Haiku',
    description: 'Fast and affordable. Good for simple classification.',
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.25,
    maxContextTokens: 200_000,
    maxOutputTokens: 4_096,
    supportsJson: false,
    supportsStreaming: true,
    tier: 'cheap',
    apiModel: 'claude-haiku-3-20240307',
  },
};

export const MODEL_FALLBACK_CHAIN: Record<string, string> = {
  'gpt-4o': 'gpt-4o-mini',
  'claude-sonnet': 'gpt-4o-mini',
  'claude-haiku': 'gpt-4o-mini',
};

export const DEFAULT_MODEL = 'gpt-4o-mini';

export function getModelConfig(modelId: string): LLMModelConfig {
  const config = LLM_MODELS[modelId];
  if (!config) {
    return LLM_MODELS[DEFAULT_MODEL];
  }
  return config;
}

export function estimateModelCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const config = getModelConfig(modelId);
  return (
    (inputTokens * config.inputCostPer1M +
      outputTokens * config.outputCostPer1M) /
    1_000_000
  );
}

export function getCheaperModel(modelId: string): string | null {
  return MODEL_FALLBACK_CHAIN[modelId] ?? null;
}

export function getAvailableModels(
  hasOpenAI: boolean,
  hasAnthropic: boolean
): LLMModelConfig[] {
  return Object.values(LLM_MODELS).filter((model) => {
    if (model.provider === 'openai' && !hasOpenAI) return false;
    if (model.provider === 'anthropic' && !hasAnthropic) return false;
    return true;
  });
}

export function getRecommendedModel(
  useCase: 'high_volume' | 'complex_reasoning' | 'classification' | 'general'
): string {
  switch (useCase) {
    case 'high_volume':
      return 'gpt-4o-mini';
    case 'complex_reasoning':
      return 'claude-sonnet';
    case 'classification':
      return 'gpt-4o-mini';
    case 'general':
      return 'gpt-4o-mini';
    default:
      return DEFAULT_MODEL;
  }
}
