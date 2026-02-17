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
