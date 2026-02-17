// src/integrations/shopify/oauth.ts

import crypto from 'crypto';
import { logger } from '@/lib/logger';

export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function buildShopifyAuthUrl(params: {
  shop: string;
  clientId: string;
  scopes: string;
  redirectUri: string;
  nonce: string;
}): string {
  const { shop, clientId, scopes, redirectUri, nonce } = params;

  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', scopes);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', nonce);

  return url.toString();
}

export function verifyHmac(
  queryParams: Record<string, string>,
  secret: string
): boolean {
  const hmac = queryParams.hmac;

  if (!hmac) return false;

  // Build message from all params except hmac
  const entries = Object.entries(queryParams)
    .filter(([key]) => key !== 'hmac')
    .sort(([a], [b]) => a.localeCompare(b));

  const message = entries
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const computed = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmac, 'hex'),
      Buffer.from(computed, 'hex')
    );
  } catch {
    return false;
  }
}

export async function exchangeCodeForToken(params: {
  shop: string;
  code: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ access_token: string; scope: string }> {
  const { shop, code, clientId, clientSecret } = params;

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error('Token exchange failed', {
      shop,
      status: response.status,
      body,
    });
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  return response.json();
}

export function verifyWebhookHmac(
  rawBody: string,
  hmacHeader: string,
  secret: string
): boolean {
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmacHeader),
      Buffer.from(computed)
    );
  } catch {
    return false;
  }
}
