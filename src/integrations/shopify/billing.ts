// src/integrations/shopify/billing.ts

import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

interface CreateChargeParams {
  shop: string;
  accessToken: string;
  name: string;
  price: number;
  trialDays: number;
  returnUrl: string;
  test?: boolean;
}

interface ShopifyRecurringCharge {
  id: number;
  name: string;
  price: string;
  status: string;
  trial_days: number;
  trial_ends_on: string | null;
  activated_on: string | null;
  cancelled_on: string | null;
  billing_on: string | null;
  confirmation_url: string;
  created_at: string;
  updated_at: string;
  test: boolean | null;
}

export class ShopifyBillingClient {
  private shop: string;
  private accessToken: string;
  private apiVersion: string;

  constructor(shop: string, accessToken: string) {
    this.shop = shop;
    this.accessToken = accessToken;
    this.apiVersion = env.SHOPIFY_API_VERSION || '2024-10';
  }

  // ─── Create Recurring Charge ───

  async createRecurringCharge(
    params: Omit<CreateChargeParams, 'shop' | 'accessToken'>
  ): Promise<{
    chargeId: string;
    confirmationUrl: string;
  }> {
    const body = {
      recurring_application_charge: {
        name: params.name,
        price: params.price,
        trial_days: params.trialDays,
        return_url: params.returnUrl,
        test: params.test ?? !env.isProduction,
      },
    };

    const response = await fetch(
      `https://${this.shop}/admin/api/${this.apiVersion}/recurring_application_charges.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('Shopify billing create failed', {
        shop: this.shop,
        status: response.status,
        body: error.substring(0, 500),
      });
      throw new Error(`Shopify billing error: ${response.status}`);
    }

    const data = await response.json();
    const charge: ShopifyRecurringCharge =
      data.recurring_application_charge;

    logger.info('Recurring charge created', {
      shop: this.shop,
      chargeId: charge.id,
      name: charge.name,
      price: charge.price,
    });

    return {
      chargeId: charge.id.toString(),
      confirmationUrl: charge.confirmation_url,
    };
  }

  // ─── Get Charge Status ───

  async getRecurringCharge(
    chargeId: string
  ): Promise<ShopifyRecurringCharge> {
    const response = await fetch(
      `https://${this.shop}/admin/api/${this.apiVersion}/recurring_application_charges/${chargeId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('Shopify billing get failed', {
        shop: this.shop,
        chargeId,
        status: response.status,
        body: error.substring(0, 500),
      });
      throw new Error(`Shopify billing error: ${response.status}`);
    }

    const data = await response.json();
    return data.recurring_application_charge;
  }

  // ─── Activate Charge ───

  async activateRecurringCharge(chargeId: string): Promise<ShopifyRecurringCharge> {
    const response = await fetch(
      `https://${this.shop}/admin/api/${this.apiVersion}/recurring_application_charges/${chargeId}/activate.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recurring_application_charge: { id: parseInt(chargeId, 10) },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('Shopify billing activate failed', {
        shop: this.shop,
        chargeId,
        status: response.status,
        body: error.substring(0, 500),
      });
      throw new Error(`Shopify billing activation error: ${response.status}`);
    }

    const data = await response.json();

    logger.info('Recurring charge activated', {
      shop: this.shop,
      chargeId,
    });

    return data.recurring_application_charge;
  }

  // ─── Cancel Charge ───

  async cancelRecurringCharge(chargeId: string): Promise<void> {
    const response = await fetch(
      `https://${this.shop}/admin/api/${this.apiVersion}/recurring_application_charges/${chargeId}.json`,
      {
        method: 'DELETE',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      logger.error('Shopify billing cancel failed', {
        shop: this.shop,
        chargeId,
        status: response.status,
      });
      throw new Error(`Shopify billing cancel error: ${response.status}`);
    }

    logger.info('Recurring charge cancelled', {
      shop: this.shop,
      chargeId,
    });
  }

  // ─── Get All Active Charges ───

  async getActiveCharges(): Promise<ShopifyRecurringCharge[]> {
    const response = await fetch(
      `https://${this.shop}/admin/api/${this.apiVersion}/recurring_application_charges.json`,
      {
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Shopify billing list error: ${response.status}`);
    }

    const data = await response.json();
    const charges: ShopifyRecurringCharge[] =
      data.recurring_application_charges ?? [];

    return charges.filter((c) => c.status === 'active');
  }
}
