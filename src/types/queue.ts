// src/types/queue.ts

import type { EventType } from './event';

export interface QueueMessage {
  eventId: string;
  storeId: string;
  type: EventType;
  payload: Record<string, unknown>;
  priority?: QueuePriority;
  scheduledFor?: Date;
}

export type QueuePriority = 'high' | 'normal' | 'low';

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLettered: number;
  avgProcessingMs: number;
}

export interface DeadLetterEntry {
  id: string;
  eventId: string;
  storeId: string;
  type: EventType;
  payload: Record<string, unknown>;
  error: string;
  retryCount: number;
  failedAt: Date;
  resolvedAt: Date | null;
}

export interface ScheduledTask {
  id: string;
  storeId: string;
  type: string;
  params: Record<string, unknown>;
  cronExpression?: string;
  runAt?: Date;
  lastRunAt?: Date;
  nextRunAt?: Date;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  createdAt: Date;
}
