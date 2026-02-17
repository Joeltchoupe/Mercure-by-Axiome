// src/app/api/events/ingest/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStore } from '@/lib/auth';
import { EventRepo } from '@/data/repositories/event.repo';
import { publishEvent } from '@/core/queue/publisher';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';
import type { EventType } from '@/types/event';

const ALLOWED_INTERNAL_EVENTS: EventType[] = [
  'product.viewed',
  'support.ticket.created',
  'support.ticket.resolved',
];

export async function POST(request: NextRequest) {
  try {
    const store = await getAuthenticatedStore();

    if (!store) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, payload } = body;

    if (!type || !payload) {
      return NextResponse.json(
        { error: 'Missing type or payload' },
        { status: 400 }
      );
    }

    if (!ALLOWED_INTERNAL_EVENTS.includes(type as EventType)) {
      return NextResponse.json(
        { error: `Event type '${type}' not allowed for manual ingestion` },
        { status: 400 }
      );
    }

    const eventId = randomUUID();

    // Save event
    const eventRepo = new EventRepo();
    const event = await eventRepo.create({
      id: eventId,
      storeId: store.id,
      shopifyEventId: null,
      type: type as EventType,
      source: 'internal',
      payload,
      receivedAt: new Date(),
    });

    // Publish to queue
    await publishEvent({
      eventId: event.id,
      storeId: store.id,
      type: type as EventType,
      payload,
    });

    logger.info('Manual event ingested', {
      eventId,
      storeId: store.id,
      type,
    });

    return NextResponse.json({ status: 'queued', eventId }, { status: 201 });
  } catch (error) {
    logger.error('Event ingest error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
