// src/types/api.ts

// ─── Generic API Response ───

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export interface ApiMeta {
  total?: number;
  limit?: number;
  offset?: number;
  page?: number;
  totalPages?: number;
  requestId?: string;
  durationMs?: number;
}

// ─── Pagination ───

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// ─── Sort ───

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── Date Range ───

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
  period?: '24h' | '7d' | '30d' | '90d' | 'custom';
  }
