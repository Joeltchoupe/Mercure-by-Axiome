// src/app/api/auth/callback/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, verifyHmac } from '@/integrations/shopify/oauth';
import { ShopifyClient } from '@/integrations/shopify/client';
import { StoreRepo } from '@/data/repositories/store.repo';
import { registerWebhooks } from '@/integrations/shopify/webhooks';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { encrypt } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get('shop');
    const code = searchParams.get('code');
    const hmac = searchParams.get('hmac');
    const nonce = searchParams.get('state');
    const timestamp = searchParams.get('timestamp');

    // ─── Validate required params ───
    if (!shop || !code || !hmac || !nonce || !timestamp) {
      logger.warn('OAuth callback missing params', {
        shop,
        hasCode: !!code,
        hasHmac: !!hmac,
        hasNonce: !!nonce,
      });
      return NextResponse.redirect(`${env.APP_URL}/install?error=missing_params`);
    }

    // ─── Validate HMAC ───
    const queryParams = Object.fromEntries(searchParams.entries());
    const isValidHmac = verifyHmac(queryParams, env.SHOPIFY_API_SECRET);

    if (!isValidHmac) {
      logger.warn('OAuth callback invalid HMAC', { shop });
      return NextResponse.redirect(`${env.APP_URL}/install?error=invalid_hmac`);
    }

    // ─── Validate nonce ───
    const storedNonce = request.cookies.get('oauth_nonce')?.value;
    const storedShop = request.cookies.get('oauth_shop')?.value;

    if (!storedNonce || storedNonce !== nonce) {
      logger.warn('OAuth callback nonce mismatch', { shop });
      return NextResponse.redirect(`${env.APP_URL}/install?error=invalid_nonce`);
    }

    if (storedShop && storedShop !== shop) {
      logger.warn('OAuth callback shop mismatch', {
        expected: storedShop,
        received: shop,
      });
      return NextResponse.redirect(`${env.APP_URL}/install?error=shop_mismatch`);
    }

    // ─── Validate timestamp (within 5 minutes) ───
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp, 10);

    if (Math.abs(now - ts) > 300) {
      logger.warn('OAuth callback timestamp expired', { shop });
      return NextResponse.redirect(`${env.APP_URL}/install?error=expired`);
    }

    // ─── Exchange code for access token ───
    const tokenResponse = await exchangeCodeForToken({
      shop,
      code,
      clientId: env.SHOPIFY_API_KEY,
      clientSecret: env.SHOPIFY_API_SECRET,
    });

    if (!tokenResponse.access_token) {
      logger.error('OAuth callback token exchange failed', { shop });
      return NextResponse.redirect(`${env.APP_URL}/install?error=token_failed`);
    }

    // ─── Get shop info ───
    const shopifyClient = new ShopifyClient(shop, tokenResponse.access_token);
    const shopInfo = await shopifyClient.getShopInfo();

    // ─── Encrypt access token before storage ───
    const encryptedToken = encrypt(tokenResponse.access_token);

    // ─── Upsert store in DB ───
    const storeRepo = new StoreRepo();
    const store = await storeRepo.upsertOnInstall({
      shopifyDomain: shop,
      accessToken: encryptedToken,
      shopName: shopInfo.name,
      email: shopInfo.email,
      plan: 'free',
      settings: {
        timezone: shopInfo.iana_timezone ?? 'Europe/Paris',
        currency: shopInfo.currency ?? 'EUR',
        notificationEmail: shopInfo.email,
        dailyLlmBudgetUsd: 25,
        monthlyLlmBudgetUsd: 500,
      },
    });

    logger.info('Store installed', {
      storeId: store.id,
      shop,
    });

    // ─── Register Shopify webhooks ───
    try {
      await registerWebhooks(shop, tokenResponse.access_token);
      logger.info('Webhooks registered', { shop });
    } catch (webhookError) {
      // Non-blocking — we can retry later
      logger.error('Webhook registration failed', {
        shop,
        error: webhookError,
      });
    }

    // ─── Set session cookie and redirect ───
    const response = NextResponse.redirect(`${env.APP_URL}/dashboard`);

    response.cookies.set('store_id', store.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    // Clean up OAuth cookies
    response.cookies.delete('oauth_nonce');
    response.cookies.delete('oauth_shop');

    return response;
  } catch (error) {
    logger.error('OAuth callback error', { error });
    return NextResponse.redirect(`${env.APP_URL}/install?error=unknown`);
  }
}
