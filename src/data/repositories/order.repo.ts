// src/data/repositories/order.repo.ts

import { db } from '@/data/db';
import type { ShopifyLineItem } from '@/integrations/shopify/types';

export interface Order {
  id: string;
  storeId: string;
  shopifyOrderId: string;
  shopifyCustomerId: string | null;
  email: string | null;
  totalPrice: number;
  subtotalPrice: number;
  totalDiscounts: number;
  currency: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  lineItems: ShopifyLineItem[];
  sourceName: string | null;
  referringSite: string | null;
  shopifyCreatedAt: Date | null;
  createdAt: Date;
}

interface OrderRow {
  id: string;
  store_id: string;
  shopify_order_id: string;
  shopify_customer_id: string | null;
  email: string | null;
  total_price: string;
  subtotal_price: string;
  total_discounts: string;
  currency: string;
  financial_status: string | null;
  fulfillment_status: string | null;
  line_items: ShopifyLineItem[];
  source_name: string | null;
  referring_site: string | null;
  shopify_created_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    storeId: row.store_id,
    shopifyOrderId: row.shopify_order_id,
    shopifyCustomerId: row.shopify_customer_id,
    email: row.email,
    totalPrice: parseFloat(row.total_price),
    subtotalPrice: parseFloat(row.subtotal_price),
    totalDiscounts: parseFloat(row.total_discounts),
    currency: row.currency,
    financialStatus: row.financial_status,
    fulfillmentStatus: row.fulfillment_status,
    lineItems: row.line_items ?? [],
    sourceName: row.source_name,
    referringSite: row.referring_site,
    shopifyCreatedAt: row.shopify_created_at,
    createdAt: row.created_at,
  };
}

export class OrderRepo {
  async getById(storeId: string, id: string): Promise<Order | null> {
    const result = await db.query<OrderRow>(
      'SELECT * FROM orders WHERE id = $1 AND store_id = $2',
      [id, storeId]
    );

    if (result.rows.length === 0) return null;
    return rowToOrder(result.rows[0]);
  }

  async getByShopifyId(
    storeId: string,
    shopifyOrderId: string
  ): Promise<Order | null> {
    const result = await db.query<OrderRow>(
      'SELECT * FROM orders WHERE store_id = $1 AND shopify_order_id = $2',
      [storeId, shopifyOrderId]
    );

    if (result.rows.length === 0) return null;
    return rowToOrder(result.rows[0]);
  }

  async upsert(params: {
    storeId: string;
    shopifyOrderId: string;
    shopifyCustomerId?: string | null;
    email?: string | null;
    totalPrice: number;
    subtotalPrice: number;
    totalDiscounts: number;
    currency: string;
    financialStatus?: string | null;
    fulfillmentStatus?: string | null;
    lineItems: ShopifyLineItem[];
    sourceName?: string | null;
    referringSite?: string | null;
    createdAt?: Date;
  }): Promise<Order> {
    const result = await db.query<OrderRow>(
      `INSERT INTO orders (
        store_id, shopify_order_id, shopify_customer_id, email,
        total_price, subtotal_price, total_discounts, currency,
        financial_status, fulfillment_status, line_items,
        source_name, referring_site, shopify_created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (store_id, shopify_order_id)
      DO UPDATE SET
        financial_status = COALESCE(EXCLUDED.financial_status, orders.financial_status),
        fulfillment_status = COALESCE(EXCLUDED.fulfillment_status, orders.fulfillment_status),
        total_price = EXCLUDED.total_price,
        total_discounts = EXCLUDED.total_discounts,
        line_items = EXCLUDED.line_items,
        updated_at = NOW()
      RETURNING *`,
      [
        params.storeId,
        params.shopifyOrderId,
        params.shopifyCustomerId ?? null,
        params.email ?? null,
        params.totalPrice,
        params.subtotalPrice,
        params.totalDiscounts,
        params.currency,
        params.financialStatus ?? null,
        params.fulfillmentStatus ?? null,
        JSON.stringify(params.lineItems),
        params.sourceName ?? null,
        params.referringSite ?? null,
        params.createdAt ?? new Date(),
      ]
    );

    return rowToOrder(result.rows[0]);
  }

  async getRecentOrders(
    storeId: string,
    params?: {
      limit?: number;
      offset?: number;
      since?: Date;
      customerId?: string;
    }
  ): Promise<Order[]> {
    const conditions = ['store_id = $1'];
    const values: unknown[] = [storeId];
    let paramIndex = 2;

    if (params?.since) {
      conditions.push(`shopify_created_at >= $${paramIndex}`);
      values.push(params.since);
      paramIndex++;
    }

    if (params?.customerId) {
      conditions.push(`shopify_customer_id = $${paramIndex}`);
      values.push(params.customerId);
      paramIndex++;
    }

    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;

    const result = await db.query<OrderRow>(
      `SELECT * FROM orders
       WHERE ${conditions.join(' AND ')}
       ORDER BY shopify_created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return result.rows.map(rowToOrder);
  }

  async getCustomerOrders(
    storeId: string,
    shopifyCustomerId: string
  ): Promise<Order[]> {
    const result = await db.query<OrderRow>(
      `SELECT * FROM orders
       WHERE store_id = $1 AND shopify_customer_id = $2
       ORDER BY shopify_created_at DESC`,
      [storeId, shopifyCustomerId]
    );

    return result.rows.map(rowToOrder);
  }

  async getOrderStats(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    totalDiscounts: number;
  }> {
    const result = await db.query<{
      total_orders: string;
      total_revenue: string;
      avg_order_value: string;
      total_discounts: string;
    }>(
      `SELECT
         COUNT(*) as total_orders,
         COALESCE(SUM(total_price), 0) as total_revenue,
         COALESCE(AVG(total_price), 0) as avg_order_value,
         COALESCE(SUM(total_discounts), 0) as total_discounts
       FROM orders
       WHERE store_id = $1
         AND shopify_created_at >= $2
         AND shopify_created_at < $3
         AND financial_status != 'refunded'
         AND financial_status != 'voided'`,
      [storeId, startDate, endDate]
    );

    const row = result.rows[0];
    return {
      totalOrders: parseInt(row.total_orders, 10),
      totalRevenue: parseFloat(row.total_revenue),
      avgOrderValue: parseFloat(row.avg_order_value),
      totalDiscounts: parseFloat(row.total_discounts),
    };
  }

  async getTopProducts(
    storeId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<
    Array<{
      productId: number;
      title: string;
      totalQuantity: number;
      totalRevenue: number;
    }>
  > {
    const result = await db.query<{
      product_id: string;
      title: string;
      total_quantity: string;
      total_revenue: string;
    }>(
      `SELECT
         item->>'product_id' as product_id,
         item->>'title' as title,
         SUM((item->>'quantity')::int) as total_quantity,
         SUM((item->>'price')::decimal * (item->>'quantity')::int) as total_revenue
       FROM orders,
            jsonb_array_elements(line_items) as item
       WHERE store_id = $1
         AND shopify_created_at >= $2
         AND shopify_created_at < $3
       GROUP BY item->>'product_id', item->>'title'
       ORDER BY total_revenue DESC
       LIMIT $4`,
      [storeId, startDate, endDate, limit]
    );

    return result.rows.map((row) => ({
      productId: parseInt(row.product_id, 10),
      title: row.title,
      totalQuantity: parseInt(row.total_quantity, 10),
      totalRevenue: parseFloat(row.total_revenue),
    }));
  }

  async getRevenueBySource(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      source: string;
      orders: number;
      revenue: number;
    }>
  > {
    const result = await db.query<{
      source_name: string;
      order_count: string;
      total_revenue: string;
    }>(
      `SELECT
         COALESCE(source_name, 'direct') as source_name,
         COUNT(*) as order_count,
         COALESCE(SUM(total_price), 0) as total_revenue
       FROM orders
       WHERE store_id = $1
         AND shopify_created_at >= $2
         AND shopify_created_at < $3
       GROUP BY source_name
       ORDER BY total_revenue DESC`,
      [storeId, startDate, endDate]
    );

    return result.rows.map((row) => ({
      source: row.source_name,
      orders: parseInt(row.order_count, 10),
      revenue: parseFloat(row.total_revenue),
    }));
  }
}
