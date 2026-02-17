// src/api/auth/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { generateNonce, buildShopifyAuthUrl } from '@/integrations/shopify/oauth';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let shop = searchParams.get('shop');

    if (!shop) {
      return NextResponse.json(
        { error: 'Missing shop parameter' },
        { status: 400 }
      );
    }

    // Normalize shop domain
    shop = normalizeShopDomain(shop);

    if (!isValidShopDomain(shop)) {
      return NextResponse.json(
        { error: 'Invalid shop domain' },
        { status: 400 }
      );
    }

    // Generate nonce for CSRF protection
    const nonce = generateNonce();

    // Build Shopify OAuth URL
    const authUrl = buildShopifyAuthUrl({
      shop,
      clientId: env.SHOPIFY_API_KEY,
      scopes: env.SHOPIFY_SCOPES,
      redirectUri: `${env.APP_URL}/api/auth/callback`,
      nonce,
    });

    // Store nonce in cookie for validation on callback
    const response = NextResponse.redirect(authUrl);

    response.cookies.set('oauth_nonce', nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    response.cookies.set('oauth_shop', shop, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    logger.info('OAuth initiated', { shop });

    return response;
  } catch (error) {
    logger.error('OAuth initiation failed', { error });
    return NextResponse.json(
      { error: 'OAuth initiation failed' },
      { status: 500 }
    );
  }
}

function normalizeShopDomain(shop: string): string {
  shop = shop.trim().toLowerCase();

  // Remove protocol
  shop = shop.replace(/^https?:\/\//, '');

  // Remove trailing slash
  shop = shop.replace(/\/$/, '');

  // Add .myshopify.com if not present
  if (!shop.includes('.myshopify.com')) {
    shop = `${shop}.myshopify.com`;
  }

  return shop;
}

function isValidShopDomain(shop: string): boolean {
  const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  return shopRegex.test(shop);
          }
