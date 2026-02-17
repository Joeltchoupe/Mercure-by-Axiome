// src/lib/logger.ts

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
  requestId?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ?? 'info';

const SENSITIVE_KEYS = new Set([
  'accesstoken',
  'access_token',
  'password',
  'secret',
  'apikey',
  'api_key',
  'token',
  'encryptionkey',
  'encryption_key',
  'authorization',
  'cookie',
  'refreshtoken',
  'refresh_token',
  'x-shopify-access-token',
]);

// ─── Core ───

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL];
}

function formatEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    entry.level.toUpperCase().padEnd(5),
    entry.message,
  ];

  if (entry.requestId) {
    parts.splice(2, 0, `[${entry.requestId}]`);
  }

  if (entry.data && Object.keys(entry.data).length > 0) {
    parts.push(JSON.stringify(entry.data));
  }

  return parts.join(' ');
}

function sanitizeData(
  data?: Record<string, unknown>,
  depth: number = 0
): Record<string, unknown> | undefined {
  if (!data || depth > 5) return data;

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase().replace(/[_-]/g, '');

    // Redact sensitive keys
    if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Handle nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (value instanceof Error) {
        sanitized[key] = {
          name: value.name,
          message: value.message,
          stack: value.stack?.split('\n').slice(0, 5).join('\n'),
        };
      } else if (value instanceof Date) {
        sanitized[key] = value.toISOString();
      } else {
        sanitized[key] = sanitizeData(
          value as Record<string, unknown>,
          depth + 1
        );
      }
      continue;
    }

    // Truncate long strings
    if (typeof value === 'string' && value.length > 500) {
      sanitized[key] = `${value.substring(0, 500)}... [truncated]`;
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

function log(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    data: sanitizeData(data),
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

// ─── Public API ───

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) =>
    log('debug', message, data),

  info: (message: string, data?: Record<string, unknown>) =>
    log('info', message, data),

  warn: (message: string, data?: Record<string, unknown>) =>
    log('warn', message, data),

  error: (message: string, data?: Record<string, unknown>) =>
    log('error', message, data),

  /**
   * Create a child logger with bound context
   */
  child: (context: Record<string, unknown>) => ({
    debug: (message: string, data?: Record<string, unknown>) =>
      log('debug', message, { ...context, ...data }),
    info: (message: string, data?: Record<string, unknown>) =>
      log('info', message, { ...context, ...data }),
    warn: (message: string, data?: Record<string, unknown>) =>
      log('warn', message, { ...context, ...data }),
    error: (message: string, data?: Record<string, unknown>) =>
      log('error', message, { ...context, ...data }),
  }),

  /**
   * Time an async operation
   */
  time: async <T>(
    label: string,
    fn: () => Promise<T>,
    data?: Record<string, unknown>
  ): Promise<T> => {
    const start = Date.now();
    try {
      const result = await fn();
      const durationMs = Date.now() - start;
      log('info', `${label} completed`, { ...data, durationMs });
      return result;
    } catch (error) {
      const durationMs = Date.now() - start;
      log('error', `${label} failed`, {
        ...data,
        durationMs,
        error: error as Error,
      });
      throw error;
    }
  },
};
