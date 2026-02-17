// src/types/integration.ts

export type IntegrationProvider = 'shopify' | 'klaviyo' | 'gorgias';

export interface Integration {
  id: string;
  storeId: string;
  provider: IntegrationProvider;
  accessToken: string; // encrypted
  refreshToken?: string; // encrypted
  config: Record<string, unknown>;
  connectedAt: Date;
}
