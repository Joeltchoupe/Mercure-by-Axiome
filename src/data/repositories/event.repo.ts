// src/data/repositories/event.repo.ts

import { db } from '@/data/db';
import type { AgentEvent, EventType, EventSource } from '@/types/event';

interface EventRow {
  id: string;
  store_id: string;
  shopify_event_id: string | null;
  type: EventType;
  source: EventSource;
  payload: Record<string, unknown>;
  received_at: Date;
  processed_at: Date | null;
}

function rowToEvent(row: EventRow): AgentEvent {
  return {
    id: row.id,
    storeId: row.store_id,
    shopifyEventId: row.shopify_event_id,
    type: row.type,
    source: row.source,
    payload: row.payload,
    receivedAt: row.received_at,
    processedAt: row.processed_at ?? undefined,
  };
}

export class EventRepo {
  async create(params: {
    id: string;
    storeId: string;
    shopifyEventId: string | null;
    type: EventType;
    source: EventSource;
    payload: Record<string, unknown>;
    receivedAt: Date;
  }): Promise<AgentEvent> {
    const result = await db.query<EventRow>(
      `INSERT INTO events (id, store_id, shopify_event_id, type, source, payload, received_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [
        params.id,
        params.storeId,
        params.shopifyEventId,
        params.type,
        params.source,
        JSON.stringify(params.payload),
        params.receivedAt,
      ]
    );

    // If ON CONFLICT, fetch the existing one
    if (result.rows.length === 0) {
      const existing = await this.getById(params.id);
      if (existing) return existing;
      throw new Error(`Failed to create or fetch event ${params.id}`);
    }

    return rowToEvent(result.rows[0]);
  }

  async getById(id: string): Promise<AgentEvent | null> {
    const result = await db.query<EventRow>(
      'SELECT * FROM events WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return null;
    return rowToEvent(result.rows[0]);
  }

  async markProcessed(id: string): Promise<void> {
    await db.query(
      'UPDATE events SET processed_at = NOW() WHERE id = $1',
      [id]
    );
  }

  async getEvents(
    storeId: string,
    params?: {
      type?: string;
      source?: string;
      limit?: number;
      offset?: number;
      since?: Date;
    }
  ): Promise<AgentEvent[]> {
    const conditions = ['store_id = $1'];
    const values: unknown[] = [storeId];
    let paramIndex = 2;

    if (params?.type) {
      conditions.push(`type = $${paramIndex}`);
      values.push(params.type);
      paramIndex++;
    }

    if (params?.source) {
      conditions.push(`source = $${paramIndex}`);
      values.push(params.source);
      paramIndex++;
    }

    if (params?.since) {
      conditions.push(`received_at >= $${paramIndex}`);
      values.push(params.since);
      paramIndex++;
    }

    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;

    const result = await db.query<EventRow>(
      `SELECT * FROM events
       WHERE ${conditions.join(' AND ')}
       ORDER BY received_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return result.rows.map(rowToEvent);
  }

  async countEvents(
    storeId: string,
    params?: { type?: string; source?: string }
  ): Promise<number> {
    const conditions = ['store_id = $1'];
    const values: unknown[] = [storeId];
    let paramIndex = 2;

    if (params?.type) {
      conditions.push(`type = $${paramIndex}`);
      values.push(params.type);
      paramIndex++;
    }

    if (params?.source) {
      conditions.push(`source = $${paramIndex}`);
      values.push(params.source);
      paramIndex++;
    }

    const result = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM events WHERE ${conditions.join(' AND ')}`,
      values
    );

    return parseInt(result.rows[0].count, 10);
  }

  async getRecentEventsForCustomer(
    storeId: string,
    customerEmail: string,
    limit: number = 50
  ): Promise<AgentEvent[]> {
    const result = await db.query<EventRow>(
      `SELECT * FROM events
       WHERE store_id = $1
         AND payload->>'email' = $2
       ORDER BY received_at DESC
       LIMIT $3`,
      [storeId, customerEmail, limit]
    );

    return result.rows.map(rowToEvent);
  }

  async cleanupOldEvents(retentionDays: number): Promise<number> {
    const result = await db.query(
      `DELETE FROM events
       WHERE received_at < NOW() - INTERVAL '1 day' * $1`,
      [retentionDays]
    );

    return result.rowCount ?? 0;
  }
    }
