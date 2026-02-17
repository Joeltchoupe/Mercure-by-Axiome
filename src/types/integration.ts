// src/types/integration.ts

export type IntegrationProvider = 'shopify' | 'klaviyo' | 'gorgias';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error';

export interface Integration {
  id: string;
  storeId: string;
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string;
  config: Record<string, unknown>;
  connectedAt: Date;
  status?: IntegrationStatus;
}

export interface IntegrationHealthCheck {
  provider: IntegrationProvider;
  connected: boolean;
  healthy: boolean;
  lastCheckedAt: Date;
  error?: string;
}

export interface IntegrationCapabilities {
  provider: IntegrationProvider;
  canRead: string[];
  canWrite: string[];
  webhooks: string[];
}

export const INTEGRATION_CAPABILITIES: Record<IntegrationProvider, IntegrationCapabilities> = {
  shopify: {
    provider: 'shopify',
    canRead: ['orders', 'customers', 'products', 'inventory', 'checkouts'],
    canWrite: ['discounts', 'tags', 'notes'],
    webhooks: [
      'orders/create',
      'orders/updated',
      'orders/fulfilled',
      'orders/cancelled',
      'checkouts/create',
      'checkouts/update',
      'customers/create',
      'customers/update',
      'carts/create',
      'carts/update',
      'products/update',
      'app/uninstalled',
    ],
  },
  klaviyo: {
    provider: 'klaviyo',
    canRead: ['profiles', 'lists', 'segments', 'flows'],
    canWrite: ['profiles', 'lists', 'events'],
    webhooks: [],
  },
  gorgias: {
    provider: 'gorgias',
    canRead: ['tickets', 'customers', 'tags'],
    canWrite: ['tickets', 'messages', 'tags', 'notes'],
    webhooks: ['ticket-created', 'ticket-updated', 'ticket-message-created'],
  },
};
