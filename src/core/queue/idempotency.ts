// src/core/queue/idempotency.ts

import { db } from '@/data/db';
import { logger } from '@/lib/logger';

export async function isProcessed(eventId: string): Promise<boolean> {
  try {
    const result = await db.query(
      'SELECT event_id FROM processed_events WHERE event_id = $1',
      [eventId]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Idempotency check failed', { eventId, error });
    // If we can't check, assume not processed (safer to double-process
    // than to skip — agents should be idempotent anyway)
    return false;
  }
}

export async function markProcessed(eventId: string): Promise<void> {
  try {
    await db.query(
      `INSERT INTO processed_events (event_id, processed_at)
       VALUES ($1, NOW())
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId]
    );
  } catch (error) {
    logger.error('Failed to mark event as processed', { eventId, error });
    // Non-blocking — worst case is a re-process
  }
}

// Clean up old processed events (run daily via cron)
export async function cleanupProcessedEvents(
  olderThanDays: number = 7
): Promise<number> {
  try {
    const result = await db.query(
      `DELETE FROM processed_events
       WHERE processed_at < NOW() - INTERVAL '1 day' * $1`,
      [olderThanDays]
    );
    const deleted = result.rowCount ?? 0;
    logger.info('Cleaned up processed events', { deleted, olderThanDays });
    return deleted;
  } catch (error) {
    logger.error('Failed to clean up processed events', { error });
    return 0;
  }
}
