// src/lib/env.ts

function getEnvVar(name: string, required = true): string {
  const value = process.env[name];

  if (!value && required) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value ?? '';
}

export const env = {
  // App
  APP_URL: getEnvVar('APP_URL'),
  NODE_ENV: getEnvVar('NODE_ENV', false) || 'development',
  INTERNAL_API_KEY: getEnvVar('INTERNAL_API_KEY'),

  // Shopify
  SHOPIFY_API_KEY: getEnvVar('SHOPIFY_API_KEY'),
  SHOPIFY_API_SECRET: getEnvVar('SHOPIFY_API_SECRET'),
  SHOPIFY_SCOPES: getEnvVar('SHOPIFY_SCOPES', false) ||
    'read_products,read_orders,read_customers,write_discounts,read_checkouts,read_inventory',

  // Database
  DATABASE_URL: getEnvVar('DATABASE_URL'),

  // QStash
  QSTASH_TOKEN: getEnvVar('QSTASH_TOKEN'),
  QSTASH_CURRENT_SIGNING_KEY: getEnvVar('QSTASH_CURRENT_SIGNING_KEY'),
  QSTASH_NEXT_SIGNING_KEY: getEnvVar('QSTASH_NEXT_SIGNING_KEY'),

  // LLM
  OPENAI_API_KEY: getEnvVar('OPENAI_API_KEY', false),
  ANTHROPIC_API_KEY: getEnvVar('ANTHROPIC_API_KEY', false),

  // Encryption
  ENCRYPTION_KEY: getEnvVar('ENCRYPTION_KEY'),
} as const;
