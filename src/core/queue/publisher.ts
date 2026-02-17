// src/core/queue/publisher.ts

import { Client } from '@upstash/qstash';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { EventType } from '@/types/event';

interface QueueMessage {
  eventId: string;
  storeId: string;
  type: EventType;
  payload: Record<string, unknown>;
}

let qstashClient: Client | null = null;

function getQStashClient(): Client {
  if (!qstashClient) {
    qstashClient = new Client({
      token: env.QSTASH_TOKEN,
    });
  }
  return qstashClient;
}

export async function publishEvent(message: QueueMessage): Promise<void> {
  const client = getQStashClient();
  const destination = `${env.APP_URL}/api/agents/execute`;

  try {
    await client.publishJSON({
      url: destination,
      body: message,
      retries: 3,
      delay: 0,
      headers: {
        'x-axiome-event-id': message.eventId,
        'x-axiome-store-id': message.storeId,
      },
    });

    logger.info('Event published to queue', {
      eventId: message.eventId,
      storeId: message.storeId,
      type: message.type,
    });
  } catch (error) {
    logger.error('Failed to publish event to queue', {
      eventId: message.eventId,
      storeId: message.storeId,
      error,
    });

    // Fallback: process synchronously
    // This prevents data loss if QStash is down
    await processSynchronousFallback(message);
  }
}

async function processSynchronousFallback(
  message: QueueMessage
): Promise<void> {
  logger.warn('Processing event synchronously (queue fallback)', {
    eventId: message.eventId,
  });

  try {
    const response = await fetch(`${env.APP_URL}/api/agents/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.INTERNAL_API_KEY}`,
        'x-axiome-event-id': message.eventId,
        'x-axiome-store-id': message.storeId,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      logger.error('Synchronous fallback failed', {
        eventId: message.eventId,
        status: response.status,
      });
    }
  } catch (error) {
    logger.error('Synchronous fallback error', {
      eventId: message.eventId,
      error,
    });
  }
}
