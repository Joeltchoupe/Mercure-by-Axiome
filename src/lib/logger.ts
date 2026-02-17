// src/lib/logger.ts

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ?? 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL];
}

function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message}`;

  if (entry.data) {
    return `${base} ${JSON.stringify(entry.data)}`;
  }

  return base;
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
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

function sanitizeData(
  data?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!data) return undefined;

  const sanitized = { ...data };

  // Never log sensitive data
  const sensitiveKeys = [
    'accessToken',
    'access_token',
    'password',
    'secret',
    'apiKey',
    'api_key',
    'token',
    'encryptionKey',
  ];

  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  }

  // Sanitize nested error objects
  if (sanitized.error instanceof Error) {
    sanitized.error = {
      message: sanitized.error.message,
      name: sanitized.error.name,
      stack: sanitized.error.stack?.split('\n').slice(0, 3).join('\n'),
    };
  }

  return sanitized;
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) =>
    log('debug', message, data),
  info: (message: string, data?: Record<string, unknown>) =>
    log('info', message, data),
  warn: (message: string, data?: Record<string, unknown>) =>
    log('warn', message, data),
  error: (message: string, data?: Record<string, unknown>) =>
    log('error', message, data),
};
