// src/data/repositories/metrics.repo.ts

import { db } from '@/data/db';
import type { DailyMetrics, AggregatedMetrics } from '@/types/store';

interface DailyMetricsRow {
  id: string;
  store_id: string;
  date: string;
  revenue: string;
  orders: number;
  new_customers: number;
  returning_customers: number;
  avg_order_value: string;
  conversion_rate: string;
  sessions: number;
  agent_actions: number;
  agent_cost_usd: string;
}

function rowToDailyMetrics(row: DailyMetricsRow): DailyMetrics {
  return {
    date: row.date,
    revenue: parseFloat(row.revenue),
    orders: row.orders,
    newCustomers: row.new_customers,
    returningCustomers: row.returning_customers,
    avgOrderValue: parseFloat(row.avg_order_value),
    conversionRate: parseFloat(row.conversion_rate),
  };
}

export class MetricsRepo {
  async getDailyMetrics(
    storeId: string,
    date: Date
  ): Promise<DailyMetrics | null> {
    const dateStr = date.toISOString().split('T')[0];

    const result = await db.query<DailyMetricsRow>(
      'SELECT * FROM daily_metrics WHERE store_id = $1 AND date = $2',
      [storeId, dateStr]
    );

    if (result.rows.length === 0) return null;
    return rowToDailyMetrics(result.rows[0]);
  }

  async getDailyMetricsList(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DailyMetrics[]> {
    const result = await db.query<DailyMetricsRow>(
      `SELECT * FROM daily_metrics
       WHERE store_id = $1
         AND date >= $2
         AND date <= $3
       ORDER BY date ASC`,
      [
        storeId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
      ]
    );

    return result.rows.map(rowToDailyMetrics);
  }

  async getAggregatedMetrics(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AggregatedMetrics> {
    const result = await db.query<{
      total_revenue: string;
      total_orders: string;
      total_new_customers: string;
      total_returning_customers: string;
      avg_order_value: string;
      avg_conversion_rate: string;
      total_agent_actions: string;
    }>(
      `SELECT
         COALESCE(SUM(revenue), 0) as total_revenue,
         COALESCE(SUM(orders), 0) as total_orders,
         COALESCE(SUM(new_customers), 0) as total_new_customers,
         COALESCE(SUM(returning_customers), 0) as total_returning_customers,
         CASE
           WHEN SUM(orders) > 0 THEN SUM(revenue) / SUM(orders)
           ELSE 0
         END as avg_order_value,
         COALESCE(AVG(conversion_rate), 0) as avg_conversion_rate,
         COALESCE(SUM(agent_actions), 0) as total_agent_actions
       FROM daily_metrics
       WHERE store_id = $1
         AND date >= $2
         AND date < $3`,
      [
        storeId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
      ]
    );

    const row = result.rows[0];

    return {
      revenue: parseFloat(row.total_revenue),
      orders: parseInt(row.total_orders, 10),
      newCustomers: parseInt(row.total_new_customers, 10),
      returningCustomers: parseInt(row.total_returning_customers, 10),
      avgOrderValue: parseFloat(row.avg_order_value),
      conversionRate: parseFloat(row.avg_conversion_rate),
      agentActions: parseInt(row.total_agent_actions, 10),
    };
  }

  async upsertDailyMetrics(
    storeId: string,
    date: Date,
    metrics: Partial<{
      revenue: number;
      orders: number;
      newCustomers: number;
      returningCustomers: number;
      avgOrderValue: number;
      conversionRate: number;
      sessions: number;
      agentActions: number;
      agentCostUsd: number;
    }>
  ): Promise<DailyMetrics> {
    const dateStr = date.toISOString().split('T')[0];

    const result = await db.query<DailyMetricsRow>(
      `INSERT INTO daily_metrics (
        store_id, date, revenue, orders, new_customers,
        returning_customers, avg_order_value, conversion_rate,
        sessions, agent_actions, agent_cost_usd
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (store_id, date)
      DO UPDATE SET
        revenue = COALESCE(EXCLUDED.revenue, daily_metrics.revenue),
        orders = COALESCE(EXCLUDED.orders, daily_metrics.orders),
        new_customers = COALESCE(EXCLUDED.new_customers, daily_metrics.new_customers),
        returning_customers = COALESCE(EXCLUDED.returning_customers, daily_metrics.returning_customers),
        avg_order_value = COALESCE(EXCLUDED.avg_order_value, daily_metrics.avg_order_value),
        conversion_rate = COALESCE(EXCLUDED.conversion_rate, daily_metrics.conversion_rate),
        sessions = COALESCE(EXCLUDED.sessions, daily_metrics.sessions),
        agent_actions = COALESCE(EXCLUDED.agent_actions, daily_metrics.agent_actions),
        agent_cost_usd = COALESCE(EXCLUDED.agent_cost_usd, daily_metrics.agent_cost_usd),
        updated_at = NOW()
      RETURNING *`,
      [
        storeId,
        dateStr,
        metrics.revenue ?? 0,
        metrics.orders ?? 0,
        metrics.newCustomers ?? 0,
        metrics.returningCustomers ?? 0,
        metrics.avgOrderValue ?? 0,
        metrics.conversionRate ?? 0,
        metrics.sessions ?? 0,
        metrics.agentActions ?? 0,
        metrics.agentCostUsd ?? 0,
      ]
    );

    return rowToDailyMetrics(result.rows[0]);
  }

  async incrementAgentActions(
    storeId: string,
    costUsd: number
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    await db.query(
      `INSERT INTO daily_metrics (store_id, date, agent_actions, agent_cost_usd)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (store_id, date)
       DO UPDATE SET
         agent_actions = daily_metrics.agent_actions + 1,
         agent_cost_usd = daily_metrics.agent_cost_usd + $3,
         updated_at = NOW()`,
      [storeId, today, costUsd]
    );
  }

  async recalculateDailyMetrics(
    storeId: string,
    date: Date
  ): Promise<DailyMetrics> {
    const dateStr = date.toISOString().split('T')[0];
    const nextDateStr = new Date(date.getTime() + 86400000)
      .toISOString()
      .split('T')[0];

    // Calculate from orders
    const orderStats = await db.query<{
      total_revenue: string;
      total_orders: string;
      avg_order_value: string;
    }>(
      `SELECT
         COALESCE(SUM(total_price), 0) as total_revenue,
         COUNT(*) as total_orders,
         COALESCE(AVG(total_price), 0) as avg_order_value
       FROM orders
       WHERE store_id = $1
         AND shopify_created_at >= $2
         AND shopify_created_at < $3
         AND financial_status NOT IN ('refunded', 'voided')`,
      [storeId, dateStr, nextDateStr]
    );

    // Calculate new vs returning
    const customerStats = await db.query<{
      new_customers: string;
      returning_customers: string;
    }>(
      `SELECT
         COUNT(*) FILTER (
           WHERE c.total_orders = 1
         ) as new_customers,
         COUNT(*) FILTER (
           WHERE c.total_orders > 1
         ) as returning_customers
       FROM orders o
       LEFT JOIN customers c ON c.store_id = o.store_id
         AND c.shopify_customer_id = o.shopify_customer_id
       WHERE o.store_id = $1
         AND o.shopify_created_at >= $2
         AND o.shopify_created_at < $3`,
      [storeId, dateStr, nextDateStr]
    );

    // Calculate agent actions
    const agentStats = await db.query<{
      agent_actions: string;
      agent_cost: string;
    }>(
      `SELECT
         COUNT(*) FILTER (
           WHERE decision IS NOT NULL
             AND decision->>'action' != 'NO_ACTION'
         ) as agent_actions,
         COALESCE(SUM(cost_usd), 0) as agent_cost
       FROM agent_runs
       WHERE store_id = $1
         AND created_at >= $2
         AND created_at < $3`,
      [storeId, dateStr, nextDateStr]
    );

    const os = orderStats.rows[0];
    const cs = customerStats.rows[0];
    const as_ = agentStats.rows[0];

    return this.upsertDailyMetrics(storeId, date, {
      revenue: parseFloat(os.total_revenue),
      orders: parseInt(os.total_orders, 10),
      avgOrderValue: parseFloat(os.avg_order_value),
      newCustomers: parseInt(cs.new_customers, 10),
      returningCustomers: parseInt(cs.returning_customers, 10),
      agentActions: parseInt(as_.agent_actions, 10),
      agentCostUsd: parseFloat(as_.agent_cost),
    });
  }

  async recalculateRange(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      await this.recalculateDailyMetrics(storeId, new Date(current));
      current.setDate(current.getDate() + 1);
      count++;
    }

    return count;
  }
}
