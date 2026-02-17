// src/integrations/klaviyo/types.ts

export interface KlaviyoWebhookPayload {
  type: string;
  id: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, unknown>;
}

export interface KlaviyoFlowConfig {
  flowId: string;
  triggerEvent: string;
  description: string;
}

export interface KlaviyoListConfig {
  listId: string;
  name: string;
  purpose: string;
}

export interface KlaviyoIntegrationConfig {
  apiKey: string;
  lists: KlaviyoListConfig[];
  flows: KlaviyoFlowConfig[];
  syncEnabled: boolean;
  syncFrequencyMinutes: number;
}
