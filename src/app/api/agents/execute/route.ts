// src/app/api/agents/execute/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyQStashSignature } from '@/core/queue/consumer';
import { Orchestrator } from '@/core/agent-os/orchestrator';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import type { EventType } from '@/types/event';

interface ExecutePayload {
  eventId: string;
  storeId: string;
  type: EventType;
  payload: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // ─── 1. Verify request source ───
    const isFromQStash = request.headers.has('upstash-signature');
    const isFromInternal =
      request.headers.get('authorization') === `Bearer ${env.INTERNAL_API_KEY}`;

    if (!isFromQStash && !isFromInternal) {
      logger.warn('Agent execute endpoint unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isFromQStash) {
      const rawBody = await request.clone().text();
      const signature = request.headers.get('upstash-signature') ?? '';
      const isValid = await verifyQStashSignature(rawBody, signature);

      if (!isValid) {
        logger.warn('Agent execute endpoint invalid QStash signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // ─── 2. Parse payload ───
    const body: ExecutePayload = await request.json();
    const { eventId, storeId, type, payload } = body;

    if (!eventId || !storeId || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // ─── 3. Execute orchestrator ───
    const orchestrator = new Orchestrator();

    await orchestrator.processEvent({
      id: eventId,
      storeId,
      type,
      payload,
      receivedAt: new Date(),
      source: 'shopify',
    });

    const duration = Date.now() - startTime;
    logger.info('Agent execution completed', {
      eventId,
      storeId,
      type,
      durationMs: duration,
    });

    return NextResponse.json(
      { status: 'executed', durationMs: duration },
      { status: 200 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Agent execution error', {
      error,
      durationMs: duration,
    });

    return NextResponse.json(
      { error: 'Execution failed', durationMs: duration },
      { status: 500 }
    );
  }
}
