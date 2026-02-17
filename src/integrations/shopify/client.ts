// src/integrations/shopify/client.ts

import { logger } from '@/lib/logger';
import type {
  ShopifyShop,
  ShopifyOrder,
  ShopifyCustomer,
  ShopifyProduct,
  ShopifyDiscount,
  ShopifyWebhook,
} from '@/integrations/shopify/types';

interface ShopifyRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  query?: Record<string, string>;
}

export class ShopifyClient {
  private shop: string;
  private accessToken: string;
  private apiVersion: string;

  constructor(shop: string, accessToken: string, apiVersion = '2024-10') {
    this.shop = shop;
    this.accessToken = accessToken;
    this.apiVersion = apiVersion;
  }

  // ─── Core Request ───

  private async request<T>(
    endpoint: string,
    options: ShopifyRequestOptions = {}
  ): Promise<T> {
    const { method = 'GET', body, query } = options;

    let url = `https://${this.shop}/admin/api/${this.apiVersion}${endpoint}`;

    if (query) {
      const params = new URLSearchParams(query);
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {
      'X-Shopify-Access-Token': this.accessToken,
      'Content-Type': 'application/json',
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (response.status === 429) {
      // Rate limited — wait and retry
      const retryAfter = parseFloat(
        response.headers.get('Retry-After') ?? '2'
      );
      logger.warn('Shopify rate limited', {
        shop: this.shop,
        endpoint,
        retryAfter,
      });
      await sleep(retryAfter * 1000);
      return this.request<T>(endpoint, options);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Shopify API error', {
        shop: this.shop,
        endpoint,
        status: response.status,
        body: errorBody,
      });
      throw new ShopifyApiError(
        `Shopify API error: ${response.status}`,
        response.status,
        errorBody
      );
    }

    // DELETE requests may return 200 with no body
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return {} as T;
    }

    return response.json();
  }

  // ─── Shop ───

  async getShopInfo(): Promise<ShopifyShop> {
    const data = await this.request<{ shop: ShopifyShop }>('/shop.json');
    return data.shop;
  }

  // ─── Orders ───

  async getOrders(params?: {
    limit?: number;
    since_id?: string;
    status?: string;
    created_at_min?: string;
    created_at_max?: string;
  }): Promise<ShopifyOrder[]> {
    const query: Record<string, string> = {};
    if (params?.limit) query.limit = params.limit.toString();
    if (params?.since_id) query.since_id = params.since_id;
    if (params?.status) query.status = params.status;
    if (params?.created_at_min) query.created_at_min = params.created_at_min;
    if (params?.created_at_max) query.created_at_max = params.created_at_max;

    const data = await this.request<{ orders: ShopifyOrder[] }>(
      '/orders.json',
      { query }
    );
    return data.orders;
  }

  async getOrder(orderId: string): Promise<ShopifyOrder> {
    const data = await this.request<{ order: ShopifyOrder }>(
      `/orders/${orderId}.json`
    );
    return data.order;
  }

  async getOrderCount(params?: {
    status?: string;
    created_at_min?: string;
  }): Promise<number> {
    const query: Record<string, string> = {};
    if (params?.status) query.status = params.status;
    if (params?.created_at_min) query.created_at_min = params.created_at_min;

    const data = await this.request<{ count: number }>(
      '/orders/count.json',
      { query }
    );
    return data.count;
  }

  // ─── Customers ───

  async getCustomer(customerId: string): Promise<ShopifyCustomer> {
    const data = await this.request<{ customer: ShopifyCustomer }>(
      `/customers/${customerId}.json`
    );
    return data.customer;
  }

  async getCustomers(params?: {
    limit?: number;
    since_id?: string;
    updated_at_min?: string;
  }): Promise<ShopifyCustomer[]> {
    const query: Record<string, string> = {};
    if (params?.limit) query.limit = params.limit.toString();
    if (params?.since_id) query.since_id = params.since_id;
    if (params?.updated_at_min) query.updated_at_min = params.updated_at_min;

    const data = await this.request<{ customers: ShopifyCustomer[] }>(
      '/customers.json',
      { query }
    );
    return data.customers;
  }

  async getCustomerOrders(customerId: string): Promise<ShopifyOrder[]> {
    const data = await this.request<{ orders: ShopifyOrder[] }>(
      `/customers/${customerId}/orders.json`,
      { query: { status: 'any' } }
    );
    return data.orders;
  }

  // ─── Products ───

  async getProduct(productId: string): Promise<ShopifyProduct> {
    const data = await this.request<{ product: ShopifyProduct }>(
      `/products/${productId}.json`
    );
    return data.product;
  }

  async getProducts(params?: {
    limit?: number;
    since_id?: string;
    collection_id?: string;
  }): Promise<ShopifyProduct[]> {
    const query: Record<string, string> = {};
    if (params?.limit) query.limit = params.limit.toString();
    if (params?.since_id) query.since_id = params.since_id;
    if (params?.collection_id) query.collection_id = params.collection_id;

    const data = await this.request<{ products: ShopifyProduct[] }>(
      '/products.json',
      { query }
    );
    return data.products;
  }

  // ─── Discounts (Price Rules) ───

  async createDiscount(params: {
    title: string;
    targetType: 'line_item' | 'shipping_line';
    valueType: 'fixed_amount' | 'percentage';
    value: string;
    customerSelection: 'all' | 'prerequisite';
    startsAt: string;
    endsAt?: string;
    usageLimit?: number;
    prerequisiteCustomerIds?: string[];
  }): Promise<ShopifyDiscount> {
    const priceRule = {
      price_rule: {
        title: params.title,
        target_type: params.targetType,
        target_selection: 'all',
        allocation_method: 'across',
        value_type: params.valueType,
        value: params.value,
        customer_selection: params.customerSelection,
        starts_at: params.startsAt,
        ends_at: params.endsAt,
        usage_limit: params.usageLimit,
        prerequisite_customer_ids: params.prerequisiteCustomerIds,
      },
    };

    const priceRuleData = await this.request<{
      price_rule: { id: string };
    }>('/price_rules.json', {
      method: 'POST',
      body: priceRule,
    });

    // Create discount code for the price rule
    const code = generateDiscountCode(params.title);

    const discountData = await this.request<{
      discount_code: ShopifyDiscount;
    }>(`/price_rules/${priceRuleData.price_rule.id}/discount_codes.json`, {
      method: 'POST',
      body: {
        discount_code: { code },
      },
    });

    return {
      ...discountData.discount_code,
      code,
      priceRuleId: priceRuleData.price_rule.id,
    };
  }

  // ─── Webhooks ───

  async getWebhooks(): Promise<ShopifyWebhook[]> {
    const data = await this.request<{ webhooks: ShopifyWebhook[] }>(
      '/webhooks.json'
    );
    return data.webhooks;
  }

  async createWebhook(params: {
    topic: string;
    address: string;
    format?: string;
  }): Promise<ShopifyWebhook> {
    const data = await this.request<{ webhook: ShopifyWebhook }>(
      '/webhooks.json',
      {
        method: 'POST',
        body: {
          webhook: {
            topic: params.topic,
            address: params.address,
            format: params.format ?? 'json',
          },
        },
      }
    );
    return data.webhook;
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    await this.request(`/webhooks/${webhookId}.json`, {
      method: 'DELETE',
    });
  }

  // ─── Inventory ───

  async getInventoryLevels(params: {
    inventoryItemIds: string[];
  }): Promise<Array<{ inventory_item_id: string; available: number; location_id: string }>> {
    const data = await this.request<{
      inventory_levels: Array<{
        inventory_item_id: string;
        available: number;
        location_id: string;
      }>;
    }>('/inventory_levels.json', {
      query: {
        inventory_item_ids: params.inventoryItemIds.join(','),
      },
    });
    return data.inventory_levels;
  }
}

// ─── Helpers ───

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateDiscountCode(prefix: string): string {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const clean = prefix.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
  return `${clean}-${random}`;
}

export class ShopifyApiError extends Error {
  status: number;
  body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'ShopifyApiError';
    this.status = status;
    this.body = body;
  }
}
