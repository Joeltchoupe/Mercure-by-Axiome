// src/core/queue/consumer.ts

import { Receiver } from '@upstash/qstash';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

let receiver: Receiver | null = null;

function getReceiver(): Receiver {
  if (!receiver) {
    receiver = new Receiver({
      currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
    });
  }
  return receiver;
}

export async function verifyQStashSignature(
  rawBody: string,
  signature: string
): Promise<boolean> {
  try {
    const recv = getReceiver();
    await recv.verify({
      body: rawBody,
      signature,
    });
    return true;
  } catch (error) {
    logger.warn('QStash signature verification failed', { error });
    return false;
  }
}

export interface ConsumedMessage {
  eventId: string;
  storeId: string;
  type: string;
  payload: Record<string, unknown>;
  priority: string;
  retryCount: number;
  receivedAt: Date;
}

export function parseConsumedMessage(
  body: Record<string, unknown>,
  headers: Headers
): ConsumedMessage {
  return {
    eventId:
      (headers.get('x-axiome-event-id') as string) ??
      (body.eventId as string) ??
      '',
    storeId:
      (headers.get('x-axiome-store-id') as string) ??
      (body.storeId as string) ??
      '',
    type: (body.type as string) ?? '',
    payload: (body.payload as Record<string, unknown>) ?? {},
    priority:
      (headers.get('x-axiome-priority') as string) ?? 'normal',
    retryCount: parseInt(
      headers.get('upstash-retried') ?? '0',
      10
    ),
    receivedAt: new Date(),
  };
  }
