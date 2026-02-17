// src/lib/env.ts

function getEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];

  if (!value && required) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Check your .env file or Vercel environment settings.`
    );
  }

  return value ?? '';
}

function getEnvInt(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBool(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value === 'true' || value === '1';
}

export const env = {
  // ─── App ───
  APP_URL: getEnvVar('APP_URL'),
  APP_NAME: getEnvVar('APP_NAME', false) || 'Axiome',
  NODE_ENV: getEnvVar('NODE_ENV', false) || 'development',
  INTERNAL_API_KEY: getEnvVar('INTERNAL_API_KEY'),
  LOG_LEVEL: getEnvVar('LOG_LEVEL', false) || 'info',

  // ─── Shopify ───
  SHOPIFY_API_KEY: getEnvVar('SHOPIFY_API_KEY'),
  SHOPIFY_API_SECRET: getEnvVar('SHOPIFY_API_SECRET'),
  SHOPIFY_API_VERSION: getEnvVar('SHOPIFY_API_VERSION', false) || '2024-10',
  SHOPIFY_SCOPES:
    getEnvVar('SHOPIFY_SCOPES', false) ||
    'read_products,read_orders,read_customers,write_discounts,read_checkouts,read_inventory',

  // ─── Database ───
  DATABASE_URL: getEnvVar('DATABASE_URL'),
  DATABASE_MAX_CONNECTIONS: getEnvInt('DATABASE_MAX_CONNECTIONS', 20),

  // ─── QStash (Queue) ───
  QSTASH_TOKEN: getEnvVar('QSTASH_TOKEN'),
  QSTASH_CURRENT_SIGNING_KEY: getEnvVar('QSTASH_CURRENT_SIGNING_KEY'),
  QSTASH_NEXT_SIGNING_KEY: getEnvVar('QSTASH_NEXT_SIGNING_KEY'),

  // ─── LLM ───
  OPENAI_API_KEY: getEnvVar('OPENAI_API_KEY', false),
  ANTHROPIC_API_KEY: getEnvVar('ANTHROPIC_API_KEY', false),
  DEFAULT_LLM_MODEL: getEnvVar('DEFAULT_LLM_MODEL', false) || 'gpt-4o-mini',

  // ─── Encryption ───
  ENCRYPTION_KEY: getEnvVar('ENCRYPTION_KEY'),

  // ─── Feature Flags ───
  ENABLE_VECTOR_STORE: getEnvBool('ENABLE_VECTOR_STORE', false),
  ENABLE_KLAVIYO: getEnvBool('ENABLE_KLAVIYO', false),
  ENABLE_GORGIAS: getEnvBool('ENABLE_GORGIAS', false),
  ENABLE_DEAD_LETTER: getEnvBool('ENABLE_DEAD_LETTER', true),

  // ─── Computed ───
  get isProduction(): boolean {
    return this.NODE_ENV === 'production';
  },
  get isDevelopment(): boolean {
    return this.NODE_ENV === 'development';
  },
  get hasOpenAI(): boolean {
    return !!this.OPENAI_API_KEY;
  },
  get hasAnthropic(): boolean {
    return !!this.ANTHROPIC_API_KEY;
  },
  get hasLLM(): boolean {
    return this.hasOpenAI || this.hasAnthropic;
  },
} as const;

// ─── Validation on startup ───

export function validateEnv(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!env.APP_URL) errors.push('APP_URL is required');
  if (!env.SHOPIFY_API_KEY) errors.push('SHOPIFY_API_KEY is required');
  if (!env.SHOPIFY_API_SECRET) errors.push('SHOPIFY_API_SECRET is required');
  if (!env.DATABASE_URL) errors.push('DATABASE_URL is required');
  if (!env.QSTASH_TOKEN) errors.push('QSTASH_TOKEN is required');
  if (!env.ENCRYPTION_KEY) errors.push('ENCRYPTION_KEY is required');
  if (!env.INTERNAL_API_KEY) errors.push('INTERNAL_API_KEY is required');

  if (!env.hasLLM) {
    errors.push(
      'At least one LLM API key is required (OPENAI_API_KEY or ANTHROPIC_API_KEY)'
    );
  }

  if (env.ENCRYPTION_KEY && env.ENCRYPTION_KEY.length !== 64) {
    errors.push(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  return { valid: errors.length === 0, errors };
}
