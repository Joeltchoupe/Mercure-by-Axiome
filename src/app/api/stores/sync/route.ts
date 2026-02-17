// src/app/api/stores/sync/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStore } from '@/lib/auth';
import { StoreRepo } from '@/data/repositories/store.repo';
import { CustomerRepo } from '@/data/repositories/customer.repo';
import { OrderRepo } from '@/data/repositories/order.repo';
import { ShopifyClient } from '@/integrations/shopify/client';
import { decrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const store = await getAuthenticatedStore();

    if (!store) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Decrypt access token
    const accessToken = decrypt(store.accessToken);
    const client = new ShopifyClient(store.shopifyDomain, accessToken);

    const customerRepo = new CustomerRepo();
    const orderRepo = new OrderRepo();

    // ─── Sync recent orders ───
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orders = await client.getOrders({
      limit: 250,
      status: 'any',
      created_at_min: thirtyDaysAgo.toISOString(),
    });

    let ordersCreated = 0;
    let customersUpserted = 0;

    for (const order of orders) {
      // Upsert order
      await orderRepo.upsert({
        storeId: store.id,
        shopifyOrderId: order.id.toString(),
        email: order.email,
        totalPrice: parseFloat(order.total_price),
        subtotalPrice: parseFloat(order.subtotal_price),
        totalDiscounts: parseFloat(order.total_discounts),
        currency: order.currency,
        financialStatus: order.financial_status,
        fulfillmentStatus: order.fulfillment_status,
        shopifyCustomerId: order.customer?.id?.toString() ?? null,
        lineItems: order.line_items,
        createdAt: new Date(order.created_at),
      });
      ordersCreated++;

      // Upsert customer if present
      if (order.customer) {
        await customerRepo.upsert({
          storeId: store.id,
          shopifyCustomerId: order.customer.id.toString(),
          email: order.customer.email,
          firstName: order.customer.first_name,
          lastName: order.customer.last_name,
          totalOrders: order.customer.orders_count,
          totalSpent: parseFloat(order.customer.total_spent),
          tags: order.customer.tags
            ? order.customer.tags.split(',').map((t) => t.trim())
            : [],
          createdAt: new Date(order.customer.created_at),
        });
        customersUpserted++;
      }
    }

    // ─── Update store sync timestamp ───
    const storeRepo = new StoreRepo();
    await storeRepo.updateLastSyncAt(store.id);

    logger.info('Store sync completed', {
      storeId: store.id,
      ordersCreated,
      customersUpserted,
    });

    return NextResponse.json({
      status: 'synced',
      orders: ordersCreated,
      customers: customersUpserted,
    });
  } catch (error) {
    logger.error('Store sync error', { error });
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 500 }
    );
  }
}
