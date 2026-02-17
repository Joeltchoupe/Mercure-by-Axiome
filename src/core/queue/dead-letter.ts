// src/core/queue/dead-letter.ts

import { db } from '@/data/db';
import { logger } from '@/lib/logger';
import type { EventType } from '@/types/event';

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

export async function addToDeadLetter(params: {
  eventId: string;
  storeId: string;
  type: EventType;
  payload: Record<string, unknown>;
  error: string;
  retryCount: number;
}): Promise<void> {
  try {
    await db.query(
      `INSERT INTO dead_letter_queue (event_id, store_id, type, payload, error, retry_count, failed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (event_id) DO UPDATE SET
         error = EXCLUDED.error,
         retry_count = EXCLUDED.retry_count,
         failed_at = NOW()`,
      [
        params.eventId,
        params.storeId,
        params.type,
        JSON.stringify(params.payload),
        params.error,
        params.retryCount,
      ]
    );

    logger.warn('Event added to dead letter queue', {
      eventId: params.eventId,
      storeId: params.storeId,
      type: params.type,
      error: params.error,
      retryCount: params.retryCount,
    });
  } catch (error) {
    logger.error('Failed to add to dead letter queue', {
      eventId: params.eventId,
      error,
    });
  }
}

export async function getDeadLetterEntries(
  storeId?: string,
  limit: number = 50
): Promise<DeadLetterEntry[]> {
  const conditions = ['resolved_at IS NULL'];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (storeId) {
    conditions.push(`store_id = $${paramIndex}`);
    values.push(storeId);
    paramIndex++;
  }

  const result = await db.query<{
    id: string;
    event_id: string;
    store_id: string;
    type: EventType;
    payload: Record<string, unknown>;
    error: string;
    retry_count: number;
    failed_at: Date;
    resolved_at: Date | null;
  }>(
    `SELECT * FROM dead_letter_queue
     WHERE ${conditions.join(' AND ')}
     ORDER BY failed_at DESC
     LIMIT $${paramIndex}`,
    [...values, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    storeId: row.store_id,
    type: row.type,
    payload: row.payload,
    error: row.error,
    retryCount: row.retry_count,
    failedAt: row.failed_at,
    resolvedAt: row.resolved_at,
  }));
}

export async function resolveDeadLetter(eventId: string): Promise<void> {
  await db.query(
    `UPDATE dead_letter_queue SET resolved_at = NOW() WHERE event_id = $1`,
    [eventId]
  );
        }
