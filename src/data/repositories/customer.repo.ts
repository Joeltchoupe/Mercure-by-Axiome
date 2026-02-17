// src/data/repositories/customer.repo.ts

import { db } from '@/data/db';
import { logger } from '@/lib/logger';

export interface Customer {
  id: string;
  storeId: string;
  shopifyCustomerId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  totalOrders: number;
  totalSpent: number;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerMetrics {
  ltv: number;
  orderCount: number;
  avgOrderValue: number;
  daysSinceLastOrder: number | null;
  daysSinceFirstOrder: number | null;
  isRepeatBuyer: boolean;
  predictedNextOrderDays: number | null;
}

interface CustomerRow {
  id: string;
  store_id: string;
  shopify_customer_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  total_orders: number;
  total_spent: string;
  first_order_at: Date | null;
  last_order_at: Date | null;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    storeId: row.store_id,
    shopifyCustomerId: row.shopify_customer_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    totalOrders: row.total_orders,
    totalSpent: parseFloat(row.total_spent),
    firstOrderAt: row.first_order_at,
    lastOrderAt: row.last_order_at,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CustomerRepo {
  async getById(storeId: string, id: string): Promise<Customer | null> {
    const result = await db.query<CustomerRow>(
      'SELECT * FROM customers WHERE id = $1 AND store_id = $2',
      [id, storeId]
    );

    if (result.rows.length === 0) return null;
    return rowToCustomer(result.rows[0]);
  }

  async getByShopifyId(
    storeId: string,
    shopifyCustomerId: string
  ): Promise<Customer | null> {
    const result = await db.query<CustomerRow>(
      'SELECT * FROM customers WHERE store_id = $1 AND shopify_customer_id = $2',
      [storeId, shopifyCustomerId]
    );

    if (result.rows.length === 0) return null;
    return rowToCustomer(result.rows[0]);
  }

  async getByEmail(
    storeId: string,
    email: string
  ): Promise<Customer | null> {
    const result = await db.query<CustomerRow>(
      'SELECT * FROM customers WHERE store_id = $1 AND email = $2',
      [storeId, email.toLowerCase()]
    );

    if (result.rows.length === 0) return null;
    return rowToCustomer(result.rows[0]);
  }

  async upsert(params: {
    storeId: string;
    shopifyCustomerId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    totalOrders?: number;
    totalSpent?: number;
    tags?: string[];
    createdAt?: Date;
  }): Promise<Customer> {
    const result = await db.query<CustomerRow>(
      `INSERT INTO customers (
        store_id, shopify_customer_id, email, first_name, last_name,
        total_orders, total_spent, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (store_id, shopify_customer_id)
      DO UPDATE SET
        email = COALESCE(EXCLUDED.email, customers.email),
        first_name = COALESCE(EXCLUDED.first_name, customers.first_name),
        last_name = COALESCE(EXCLUDED.last_name, customers.last_name),
        total_orders = GREATEST(EXCLUDED.total_orders, customers.total_orders),
        total_spent = GREATEST(EXCLUDED.total_spent, customers.total_spent),
        tags = COALESCE(EXCLUDED.tags, customers.tags),
        updated_at = NOW()
      RETURNING *`,
      [
        params.storeId,
        params.shopifyCustomerId,
        params.email?.toLowerCase() ?? null,
        params.firstName ?? null,
        params.lastName ?? null,
        params.totalOrders ?? 0,
        params.totalSpent ?? 0,
        JSON.stringify(params.tags ?? []),
      ]
    );

    return rowToCustomer(result.rows[0]);
  }

  async updateOrderStats(
    storeId: string,
    shopifyCustomerId: string,
    orderDate: Date,
    orderAmount: number
  ): Promise<void> {
    await db.query(
      `UPDATE customers
       SET
         total_orders = total_orders + 1,
         total_spent = total_spent + $3,
         first_order_at = COALESCE(first_order_at, $4),
         last_order_at = GREATEST(last_order_at, $4),
         updated_at = NOW()
       WHERE store_id = $1 AND shopify_customer_id = $2`,
      [storeId, shopifyCustomerId, orderAmount, orderDate]
    );
  }

  async getMetrics(
    storeId: string,
    shopifyCustomerId: string
  ): Promise<CustomerMetrics | null> {
    const customer = await this.getByShopifyId(storeId, shopifyCustomerId);
    if (!customer) return null;

    const now = new Date();

    const daysSinceLastOrder = customer.lastOrderAt
      ? Math.floor(
          (now.getTime() - customer.lastOrderAt.getTime()) / (1000 * 60 * 60 * 24)
        )
      : null;

    const daysSinceFirstOrder = customer.firstOrderAt
      ? Math.floor(
          (now.getTime() - customer.firstOrderAt.getTime()) / (1000 * 60 * 60 * 24)
        )
      : null;

    const avgOrderValue =
      customer.totalOrders > 0
        ? customer.totalSpent / customer.totalOrders
        : 0;

    // Simple prediction: average days between orders
    let predictedNextOrderDays: number | null = null;
    if (
      customer.totalOrders >= 2 &&
      customer.firstOrderAt &&
      customer.lastOrderAt
    ) {
      const totalDays = Math.floor(
        (customer.lastOrderAt.getTime() - customer.firstOrderAt.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const avgDaysBetween = totalDays / (customer.totalOrders - 1);
      predictedNextOrderDays = Math.round(avgDaysBetween);
    }

    return {
      ltv: customer.totalSpent,
      orderCount: customer.totalOrders,
      avgOrderValue,
      daysSinceLastOrder,
      daysSinceFirstOrder,
      isRepeatBuyer: customer.totalOrders > 1,
      predictedNextOrderDays,
    };
  }

  async getTopCustomers(
    storeId: string,
    limit: number = 20
  ): Promise<Customer[]> {
    const result = await db.query<CustomerRow>(
      `SELECT * FROM customers
       WHERE store_id = $1
       ORDER BY total_spent DESC
       LIMIT $2`,
      [storeId, limit]
    );

    return result.rows.map(rowToCustomer);
  }

  async getAtRiskCustomers(
    storeId: string,
    inactiveDays: number = 60
  ): Promise<Customer[]> {
    const result = await db.query<CustomerRow>(
      `SELECT * FROM customers
       WHERE store_id = $1
         AND total_orders >= 2
         AND last_order_at < NOW() - INTERVAL '1 day' * $2
       ORDER BY total_spent DESC`,
      [storeId, inactiveDays]
    );

    return result.rows.map(rowToCustomer);
  }

  async getNewCustomers(
    storeId: string,
    since: Date
  ): Promise<Customer[]> {
    const result = await db.query<CustomerRow>(
      `SELECT * FROM customers
       WHERE store_id = $1
         AND created_at >= $2
       ORDER BY created_at DESC`,
      [storeId, since]
    );

    return result.rows.map(rowToCustomer);
  }

  async getCustomerCount(storeId: string): Promise<{
    total: number;
    repeatBuyers: number;
    newThisMonth: number;
  }> {
    const result = await db.query<{
      total: string;
      repeat_buyers: string;
      new_this_month: string;
    }>(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE total_orders > 1) as repeat_buyers,
         COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW())) as new_this_month
       FROM customers
       WHERE store_id = $1`,
      [storeId]
    );

    return {
      total: parseInt(result.rows[0].total, 10),
      repeatBuyers: parseInt(result.rows[0].repeat_buyers, 10),
      newThisMonth: parseInt(result.rows[0].new_this_month, 10),
    };
  }

  async getSegmentation(storeId: string): Promise<{
    vip: number;
    active: number;
    atRisk: number;
    dormant: number;
    oneTime: number;
  }> {
    const result = await db.query<{
      vip: string;
      active: string;
      at_risk: string;
      dormant: string;
      one_time: string;
    }>(
      `SELECT
         COUNT(*) FILTER (
           WHERE total_orders >= 5 OR total_spent >= 500
         ) as vip,
         COUNT(*) FILTER (
           WHERE total_orders >= 2
             AND last_order_at >= NOW() - INTERVAL '60 days'
             AND NOT (total_orders >= 5 OR total_spent >= 500)
         ) as active,
         COUNT(*) FILTER (
           WHERE total_orders >= 2
             AND last_order_at < NOW() - INTERVAL '60 days'
             AND last_order_at >= NOW() - INTERVAL '120 days'
         ) as at_risk,
         COUNT(*) FILTER (
           WHERE total_orders >= 2
             AND last_order_at < NOW() - INTERVAL '120 days'
         ) as dormant,
         COUNT(*) FILTER (
           WHERE total_orders = 1
         ) as one_time
       FROM customers
       WHERE store_id = $1`,
      [storeId]
    );

    return {
      vip: parseInt(result.rows[0].vip, 10),
      active: parseInt(result.rows[0].active, 10),
      atRisk: parseInt(result.rows[0].at_risk, 10),
      dormant: parseInt(result.rows[0].dormant, 10),
      oneTime: parseInt(result.rows[0].one_time, 10),
    };
  }
    }
