// src/lib/errors.ts

// ─── Base ───

export class AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  details?: Record<string, string>;

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code ?? 'INTERNAL_ERROR';
    this.isOperational = isOperational;
  }

  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

// ─── Auth ───

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHENTICATED');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'UNAUTHORIZED');
    this.name = 'AuthorizationError';
  }
}

// ─── Resource ───

export class NotFoundError extends AppError {
  resource: string;

  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
    this.resource = resource;
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

// ─── Validation ───

export class ValidationError extends AppError {
  fields: Record<string, string>;

  constructor(message: string, fields: Record<string, string> = {}) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.fields = fields;
    this.details = fields;
  }
}

// ─── Rate Limiting ───

export class RateLimitError extends AppError {
  retryAfterSec: number;

  constructor(retryAfterSec: number = 60) {
    super('Rate limit exceeded', 429, 'RATE_LIMITED');
    this.name = 'RateLimitError';
    this.retryAfterSec = retryAfterSec;
  }
}

// ─── External Services ───

export class ExternalServiceError extends AppError {
  service: string;
  originalStatus?: number;

  constructor(service: string, message: string, originalStatus?: number) {
    super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
    this.name = 'ExternalServiceError';
    this.service = service;
    this.originalStatus = originalStatus;
  }
}

export class ShopifyError extends ExternalServiceError {
  constructor(message: string, status?: number) {
    super('Shopify', message, status);
    this.name = 'ShopifyError';
    this.code = 'SHOPIFY_ERROR';
  }
}

export class KlaviyoError extends ExternalServiceError {
  constructor(message: string, status?: number) {
    super('Klaviyo', message, status);
    this.name = 'KlaviyoError';
    this.code = 'KLAVIYO_ERROR';
  }
}

export class GorgiasError extends ExternalServiceError {
  constructor(message: string, status?: number) {
    super('Gorgias', message, status);
    this.name = 'GorgiasError';
    this.code = 'GORGIAS_ERROR';
  }
}

// ─── Agent ───

export class AgentError extends AppError {
  agentType: string;

  constructor(agentType: string, message: string) {
    super(`Agent ${agentType}: ${message}`, 500, 'AGENT_ERROR');
    this.name = 'AgentError';
    this.agentType = agentType;
  }
}

export class BudgetExceededError extends AppError {
  spent: number;
  limit: number;

  constructor(spent: number, limit: number, scope: string = 'daily') {
    super(
      `LLM ${scope} budget exceeded: $${spent.toFixed(2)} / $${limit.toFixed(2)}`,
      429,
      'BUDGET_EXCEEDED'
    );
    this.name = 'BudgetExceededError';
    this.spent = spent;
    this.limit = limit;
  }
}

// ─── Queue ───

export class QueueError extends AppError {
  constructor(message: string) {
    super(message, 500, 'QUEUE_ERROR');
    this.name = 'QueueError';
  }
}

// ─── Helpers ───

export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof Error) {
    return new AppError(error.message, 500, 'INTERNAL_ERROR', false);
  }

  return new AppError(
    'An unexpected error occurred',
    500,
    'UNKNOWN_ERROR',
    false
  );
}

export function errorToResponse(error: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  const appError = toAppError(error);

  return {
    status: appError.statusCode,
    body: appError.toJSON(),
  };
              }
