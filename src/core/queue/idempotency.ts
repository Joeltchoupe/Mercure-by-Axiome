// src/core/queue/idempotency.ts

import { db } from '@/data/db';
import { logger } from '@/lib/logger';

// In-memory cache for hot path — avoids DB round trip for recent events
const recentlyProcessed = new Map<string, number>();
const MEMORY_CACHE_TTL_MS = 60_000; // 1 minute
const MEMORY_CACHE_MAX_SIZE = 10_000;

export async function isProcessed(eventId: string): Promise<boolean> {
  // 1. Check memory cache first (hot path)
  const cached = recentlyProcessed.get(eventId);
  if (cached && Date.now() - cached < MEMORY_CACHE_TTL_MS) {
    return true;
  }

  // 2. Check database
  try {
    const result = await db.query(
      'SELECT event_id FROM processed_events WHERE event_id = $1',
      [eventId]
    );

    if (result.rows.length > 0) {
      // Warm the cache
      addToMemoryCache(eventId);
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Idempotency check failed', { eventId, error });
    // If DB is down, assume not processed — agents must be idempotent
    return false;
  }
}

export async function markProcessed(eventId: string): Promise<void> {
  // 1. Add to memory cache immediately
  addToMemoryCache(eventId);

  // 2. Persist to database
  try {
    await db.query(
      `INSERT INTO processed_events (event_id, processed_at)
       VALUES ($1, NOW())
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId]
    );
  } catch (error) {
    logger.error('Failed to mark event as processed', { eventId, error });
  }
}

export async function markBatchProcessed(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;

  // 1. Memory cache
  for (const id of eventIds) {
    addToMemoryCache(id);
  }

  // 2. Database batch insert
  try {
    const values = eventIds
      .map((_, i) => `($${i + 1}, NOW())`)
      .join(', ');

    await db.query(
      `INSERT INTO processed_events (event_id, processed_at)
       VALUES ${values}
       ON CONFLICT (event_id) DO NOTHING`,
      eventIds
    );
  } catch (error) {
    logger.error('Failed to mark batch as processed', {
      count: eventIds.length,
      error,
    });
  }
}

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

    logger.info('Cleaned up processed events', {
      deleted,
      olderThanDays,
    });

    return deleted;
  } catch (error) {
    logger.error('Failed to clean up processed events', { error });
    return 0;
  }
}

// ─── Memory Cache Management ───

function addToMemoryCache(eventId: string): void {
  // Evict old entries if cache is too large
  if (recentlyProcessed.size >= MEMORY_CACHE_MAX_SIZE) {
    evictOldEntries();
  }

  recentlyProcessed.set(eventId, Date.now());
}

function evictOldEntries(): void {
  const now = Date.now();
  const toDelete: string[] = [];

  for (const [key, timestamp] of recentlyProcessed.entries()) {
    if (now - timestamp > MEMORY_CACHE_TTL_MS) {
      toDelete.push(key);
    }
  }

  for (const key of toDelete) {
    recentlyProcessed.delete(key);
  }

  // If still too large, evict oldest
  if (recentlyProcessed.size >= MEMORY_CACHE_MAX_SIZE) {
    const entries = Array.from(recentlyProcessed.entries())
      .sort((a, b) => a[1] - b[1]);

    const toRemove = entries.slice(
      0,
      Math.floor(MEMORY_CACHE_MAX_SIZE * 0.3)
    );

    for (const [key] of toRemove) {
      recentlyProcessed.delete(key);
    }
  }
}  olderThanDays: number = 7
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
