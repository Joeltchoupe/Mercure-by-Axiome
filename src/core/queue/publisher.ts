// src/core/queue/publisher.ts

import { Client } from '@upstash/qstash';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { EventType } from '@/types/event';

export interface QueueMessage {
  eventId: string;
  storeId: string;
  type: EventType;
  payload: Record<string, unknown>;
  priority?: 'high' | 'normal' | 'low';
  scheduledFor?: Date;
}

interface PublishOptions {
  retries?: number;
  delaySec?: number;
  deduplicationId?: string;
  callbackUrl?: string;
}

let qstashClient: Client | null = null;

function getClient(): Client {
  if (!qstashClient) {
    qstashClient = new Client({
      token: env.QSTASH_TOKEN,
    });
  }
  return qstashClient;
}

export async function publishEvent(
  message: QueueMessage,
  options?: PublishOptions
): Promise<string | null> {
  const destination = `${env.APP_URL}/api/agents/execute`;

  try {
    const client = getClient();

    const publishParams: Record<string, unknown> = {
      url: destination,
      body: JSON.stringify(message),
      headers: {
        'Content-Type': 'application/json',
        'x-axiome-event-id': message.eventId,
        'x-axiome-store-id': message.storeId,
        'x-axiome-priority': message.priority ?? 'normal',
      },
      retries: options?.retries ?? 3,
    };

    // Delay
    if (options?.delaySec && options.delaySec > 0) {
      publishParams.delay = options.delaySec;
    }

    // Scheduled delivery
    if (message.scheduledFor) {
      const delaySec = Math.max(
        0,
        Math.floor((message.scheduledFor.getTime() - Date.now()) / 1000)
      );
      if (delaySec > 0) {
        publishParams.delay = delaySec;
      }
    }

    // Deduplication
    if (options?.deduplicationId) {
      publishParams.deduplicationId = options.deduplicationId;
    }

    // Callback for tracking delivery
    if (options?.callbackUrl) {
      publishParams.callback = options.callbackUrl;
    }

    const response = await client.publishJSON(publishParams as any);

    logger.info('Event published to queue', {
      eventId: message.eventId,
      storeId: message.storeId,
      type: message.type,
      messageId: response.messageId,
      priority: message.priority ?? 'normal',
      delaySec: options?.delaySec ?? 0,
    });

    return response.messageId;
  } catch (error) {
    logger.error('Failed to publish event to queue', {
      eventId: message.eventId,
      storeId: message.storeId,
      type: message.type,
      error,
    });

    // Fallback: process synchronously
    return fallbackSynchronous(message);
  }
}

export async function publishBatch(
  messages: QueueMessage[]
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;

  // QStash batch API
  const client = getClient();
  const destination = `${env.APP_URL}/api/agents/execute`;

  const batchMessages = messages.map((msg) => ({
    destination,
    body: JSON.stringify(msg),
    headers: {
      'Content-Type': 'application/json',
      'x-axiome-event-id': msg.eventId,
      'x-axiome-store-id': msg.storeId,
    },
    retries: 3,
  }));

  // QStash supports batch up to 100 messages
  const chunks = chunkArray(batchMessages, 100);

  for (const chunk of chunks) {
    try {
      await client.batchJSON(chunk as any);
      succeeded += chunk.length;
    } catch (error) {
      logger.error('Batch publish failed', {
        chunkSize: chunk.length,
        error,
      });
      failed += chunk.length;

      // Fallback: publish individually
      for (const msg of chunk) {
        try {
          const parsed = JSON.parse(msg.body as string) as QueueMessage;
          await publishEvent(parsed);
          succeeded++;
          failed--;
        } catch {
          // Already counted as failed
        }
      }
    }
  }

  logger.info('Batch publish completed', { succeeded, failed });
  return { succeeded, failed };
}

export async function publishScheduled(
  message: QueueMessage,
  cronExpression: string
): Promise<string | null> {
  const destination = `${env.APP_URL}/api/agents/execute`;

  try {
    const client = getClient();

    const schedule = await client.schedules.create({
      destination,
      body: JSON.stringify(message),
      headers: {
        'Content-Type': 'application/json',
        'x-axiome-event-id': message.eventId,
        'x-axiome-store-id': message.storeId,
      },
      cron: cronExpression,
      retries: 3,
    });

    logger.info('Scheduled event created', {
      scheduleId: schedule.scheduleId,
      storeId: message.storeId,
      cron: cronExpression,
    });

    return schedule.scheduleId;
  } catch (error) {
    logger.error('Failed to create scheduled event', {
      storeId: message.storeId,
      error,
    });
    return null;
  }
}

export async function cancelScheduled(scheduleId: string): Promise<void> {
  try {
    const client = getClient();
    await client.schedules.delete(scheduleId);
    logger.info('Scheduled event cancelled', { scheduleId });
  } catch (error) {
    logger.error('Failed to cancel scheduled event', { scheduleId, error });
  }
}

// ─── Fallback ───

async function fallbackSynchronous(
  message: QueueMessage
): Promise<string | null> {
  logger.warn('Processing event synchronously (queue fallback)', {
    eventId: message.eventId,
    storeId: message.storeId,
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
      return null;
    }

    return `sync-${message.eventId}`;
  } catch (error) {
    logger.error('Synchronous fallback error', {
      eventId: message.eventId,
      error,
    });
    return null;
  }
}

// ─── Helpers ───

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
