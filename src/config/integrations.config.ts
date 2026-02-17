// src/config/integrations.config.ts

import type { IntegrationProvider } from '@/types/integration';

export interface IntegrationConfig {
  provider: IntegrationProvider;
  label: string;
  description: string;
  required: boolean;
  authType: 'oauth' | 'api_key';
  setupUrl?: string;
  docsUrl?: string;
  requiredScopes?: string[];
  webhookTopics?: string[];
  healthCheckEndpoint?: string;
  icon: string;
  color: string;
}

export const INTEGRATION_CONFIGS: Record<IntegrationProvider, IntegrationConfig> = {
  shopify: {
    provider: 'shopify',
    label: 'Shopify',
    description: 'Your store. Core integration. Always connected.',
    required: true,
    authType: 'oauth',
    requiredScopes: [
      'read_products',
      'read_orders',
      'read_customers',
      'write_discounts',
      'read_checkouts',
      'read_inventory',
    ],
    webhookTopics: [
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
    icon: 'ShoppingBag',
    color: '#96BF48',
  },
  klaviyo: {
    provider: 'klaviyo',
    label: 'Klaviyo',
    description: 'Email & SMS marketing automation. Enables retention agent flows.',
    required: false,
    authType: 'api_key',
    docsUrl: 'https://developers.klaviyo.com',
    healthCheckEndpoint: '/api/lists',
    icon: 'Mail',
    color: '#000000',
  },
  gorgias: {
    provider: 'gorgias',
    label: 'Gorgias',
    description: 'Customer support helpdesk. Enables support agent automation.',
    required: false,
    authType: 'api_key',
    docsUrl: 'https://developers.gorgias.com',
    healthCheckEndpoint: '/api/tickets',
    webhookTopics: [
      'ticket-created',
      'ticket-updated',
      'ticket-message-created',
    ],
    icon: 'Headphones',
    color: '#3B82F6',
  },
};

export const INTEGRATION_PROVIDER_LIST: IntegrationProvider[] = [
  'shopify',
  'klaviyo',
  'gorgias',
];

export function getIntegrationConfig(
  provider: IntegrationProvider
): IntegrationConfig {
  const config = INTEGRATION_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unknown integration provider: ${provider}`);
  }
  return config;
}

export function isValidProvider(value: string): value is IntegrationProvider {
  return INTEGRATION_PROVIDER_LIST.includes(value as IntegrationProvider);
}
