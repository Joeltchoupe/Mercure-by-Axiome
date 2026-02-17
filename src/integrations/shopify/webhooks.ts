// src/integrations/shopify/webhooks.ts

import { ShopifyClient } from '@/integrations/shopify/client';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// All webhook topics we need
const REQUIRED_WEBHOOKS = [
  'orders/create',
  'orders/updated',
  'orders/fulfilled',
  'orders/cancelled',
  'checkouts/create',
  'checkouts/update',
  'customers/create',
  'customers/update',
  'carts/create',
  'carts/update',
  'products/update',
  'app/uninstalled',
] as const;

export type WebhookTopic = (typeof REQUIRED_WEBHOOKS)[number];

export async function registerWebhooks(
  shop: string,
  accessToken: string
): Promise<void> {
  const client = new ShopifyClient(shop, accessToken);
  const webhookBaseUrl = `${env.APP_URL}/api/webhooks/shopify`;

  // Get existing webhooks
  const existingWebhooks = await client.getWebhooks();
  const existingTopics = new Set(existingWebhooks.map((w) => w.topic));

  // Delete webhooks pointing to old URLs
  for (const webhook of existingWebhooks) {
    if (webhook.address !== webhookBaseUrl) {
      try {
        await client.deleteWebhook(webhook.id.toString());
        logger.info('Deleted stale webhook', {
          shop,
          topic: webhook.topic,
          oldAddress: webhook.address,
        });
      } catch (error) {
        logger.warn('Failed to delete stale webhook', {
          shop,
          webhookId: webhook.id,
          error,
        });
      }
    }
  }

  // Register missing webhooks
  for (const topic of REQUIRED_WEBHOOKS) {
    // Check if already registered with correct URL
    const existing = existingWebhooks.find(
      (w) => w.topic === topic && w.address === webhookBaseUrl
    );

    if (existing) {
      logger.debug('Webhook already registered', { shop, topic });
      continue;
    }

    try {
      await client.createWebhook({
        topic,
        address: webhookBaseUrl,
        format: 'json',
      });
      logger.info('Webhook registered', { shop, topic });
    } catch (error) {
      logger.error('Failed to register webhook', {
        shop,
        topic,
        error,
      });
      // Continue with other webhooks — don't fail the entire registration
    }

    // Small delay to avoid rate limiting
    await sleep(250);
  }
}

export async function unregisterWebhooks(
  shop: string,
  accessToken: string
): Promise<void> {
  const client = new ShopifyClient(shop, accessToken);

  try {
    const webhooks = await client.getWebhooks();

    for (const webhook of webhooks) {
      try {
        await client.deleteWebhook(webhook.id.toString());
        logger.info('Webhook unregistered', { shop, topic: webhook.topic });
      } catch (error) {
        logger.warn('Failed to unregister webhook', {
          shop,
          webhookId: webhook.id,
          error,
        });
      }
      await sleep(250);
    }
  } catch (error) {
    logger.error('Failed to unregister webhooks', { shop, error });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
        }
