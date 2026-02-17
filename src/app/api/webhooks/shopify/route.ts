// src/app/api/webhooks/shopify/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookHmac } from '@/integrations/shopify/oauth';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { EventRepo } from '@/data/repositories/event.repo';
import { StoreRepo } from '@/data/repositories/store.repo';
import { isProcessed, markProcessed } from '@/core/queue/idempotency';
import { publishEvent } from '@/core/queue/publisher';
import { mapWebhookToEventType } from '@/integrations/shopify/webhook-mapper';
import type { EventType } from '@/types/event';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // ─── 1. Read raw body for HMAC verification ───
    const rawBody = await request.text();
    const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
    const shopDomain = request.headers.get('x-shopify-shop-domain');
    const topic = request.headers.get('x-shopify-topic');
    const webhookId = request.headers.get('x-shopify-webhook-id');

    if (!hmacHeader || !shopDomain || !topic) {
      logger.warn('Webhook missing required headers', {
        hasHmac: !!hmacHeader,
        hasShop: !!shopDomain,
        hasTopic: !!topic,
      });
      return NextResponse.json({ error: 'Missing headers' }, { status: 401 });
    }

    // ─── 2. Verify HMAC — CRITICAL ───
    const isValid = verifyWebhookHmac(
      rawBody,
      hmacHeader,
      env.SHOPIFY_API_SECRET
    );

    if (!isValid) {
      logger.warn('Webhook HMAC verification failed', {
        shop: shopDomain,
        topic,
      });
      return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 });
    }

    // ─── 3. ACK immediately (Shopify 5s timeout) ───
    // We process everything AFTER sending the response
    // But in Vercel, we can't do background work after response
    // So we use waitUntil or queue

    // ─── 4. Idempotency check ───
    const eventId = webhookId ?? generateEventId(shopDomain, topic, rawBody);

    if (await isProcessed(eventId)) {
      logger.debug('Webhook already processed', {
        eventId,
        shop: shopDomain,
        topic,
      });
      return NextResponse.json({ status: 'already_processed' }, { status: 200 });
    }

    // ─── 5. Parse payload ───
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      logger.error('Webhook payload parse error', {
        shop: shopDomain,
        topic,
      });
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // ─── 6. Handle app/uninstalled specially ───
    if (topic === 'app/uninstalled') {
      await handleAppUninstalled(shopDomain);
      await markProcessed(eventId);
      return NextResponse.json({ status: 'processed' }, { status: 200 });
    }

    // ─── 7. Find store ───
    const storeRepo = new StoreRepo();
    const store = await storeRepo.getByDomain(shopDomain);

    if (!store) {
      logger.warn('Webhook for unknown store', {
        shop: shopDomain,
        topic,
      });
      return NextResponse.json({ status: 'unknown_store' }, { status: 200 });
    }

    if (store.uninstalledAt) {
      logger.debug('Webhook for uninstalled store', {
        shop: shopDomain,
        topic,
      });
      return NextResponse.json({ status: 'store_uninstalled' }, { status: 200 });
    }

    // ─── 8. Map topic to internal event type ───
    const eventType = mapWebhookToEventType(topic);

    if (!eventType) {
      logger.debug('Unmapped webhook topic', { topic, shop: shopDomain });
      await markProcessed(eventId);
      return NextResponse.json({ status: 'unmapped_topic' }, { status: 200 });
    }

    // ─── 9. Save event to DB ───
    const eventRepo = new EventRepo();
    const event = await eventRepo.create({
      id: eventId,
      storeId: store.id,
      shopifyEventId: webhookId ?? null,
      type: eventType,
      source: 'shopify',
      payload,
      receivedAt: new Date(),
    });

    // ─── 10. Publish to queue for async agent processing ───
    await publishEvent({
      eventId: event.id,
      storeId: store.id,
      type: eventType,
      payload,
    });

    // ─── 11. Mark as processed ───
    await markProcessed(eventId);

    const duration = Date.now() - startTime;
    logger.info('Webhook processed', {
      eventId,
      shop: shopDomain,
      topic,
      eventType,
      durationMs: duration,
    });

    return NextResponse.json({ status: 'queued' }, { status: 200 });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Webhook processing error', {
      error,
      durationMs: duration,
    });

    // Still return 200 to prevent Shopify from retrying
    // (we log the error and can investigate)
    return NextResponse.json({ status: 'error_logged' }, { status: 200 });
  }
}

// ─── Handle app/uninstalled ───

async function handleAppUninstalled(shopDomain: string): Promise<void> {
  const storeRepo = new StoreRepo();

  try {
    await storeRepo.markUninstalledByDomain(shopDomain);
    logger.info('App uninstalled', { shop: shopDomain });
  } catch (error) {
    logger.error('Failed to handle app uninstall', {
      shop: shopDomain,
      error,
    });
  }
}

// ─── Generate deterministic event ID ───

function generateEventId(
  shop: string,
  topic: string,
  body: string
): string {
  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(`${shop}:${topic}:${body}`)
    .digest('hex')
    .substring(0, 32);
}
