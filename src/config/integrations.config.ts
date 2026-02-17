// src/config/integrations.config.ts

import type { IntegrationProvider } from '@/types/integration';

interface IntegrationConfig {
  label: string;
  description: string;
  required: boolean;
  authType: 'oauth' | 'api_key';
  webhookTopics?: string[];
}

export const INTEGRATION_CONFIGS: Record<IntegrationProvider, IntegrationConfig> = {
  shopify: {
    label: 'Shopify',
    description: 'Your store. Core integration.',
    required: true,
    authType: 'oauth',
    webhookTopics: [
      'orders/create',
      'orders/updated',
      'orders/fulfilled',
      'customers/create',
      'customers/update',
      'checkouts/create',
      'checkouts/update',
      'carts/create',
      'carts/update',
      'products/update',
      'app/uninstalled',
    ],
  },
  klaviyo: {
    label: 'Klaviyo',
    description: 'Email & SMS marketing automation.',
    required: false,
    authType: 'api_key',
  },
  gorgias: {
    label: 'Gorgias',
    description: 'Customer support helpdesk.',
    required: false,
    authType: 'api_key',
  },
};
