// src/integrations/shopify/proxy.ts

import { ShopifyClient } from '@/integrations/shopify/client';
import { logger } from '@/lib/logger';
import type { ShopifyOrder, ShopifyCustomer, ShopifyProduct } from '@/integrations/shopify/types';

export interface ProxiedStoreData {
  shopInfo: {
    name: string;
    currency: string;
    timezone: string;
  };
  recentOrders: ShopifyOrder[];
  topProducts: ShopifyProduct[];
  orderCount: number;
}

export class ShopifyProxy {
  private client: ShopifyClient;

  constructor(shop: string, accessToken: string) {
    this.client = new ShopifyClient(shop, accessToken);
  }

  async getStoreSnapshot(): Promise<ProxiedStoreData> {
    try {
      const [shopInfo, recentOrders, topProducts, orderCount] =
        await Promise.all([
          this.client.getShopInfo(),
          this.client.getOrders({ limit: 50, status: 'any' }),
          this.client.getProducts({ limit: 20 }),
          this.client.getOrderCount(),
        ]);

      return {
        shopInfo: {
          name: shopInfo.name,
          currency: shopInfo.currency,
          timezone: shopInfo.iana_timezone,
        },
        recentOrders,
        topProducts,
        orderCount,
      };
    } catch (error) {
      logger.error('Failed to get store snapshot', { error });
      throw error;
    }
  }

  async getCustomerFullProfile(
    customerId: string
  ): Promise<{
    customer: ShopifyCustomer;
    orders: ShopifyOrder[];
    totalSpent: number;
    avgOrderValue: number;
  }> {
    const [customer, orders] = await Promise.all([
      this.client.getCustomer(customerId),
      this.client.getCustomerOrders(customerId),
    ]);

    const totalSpent = orders.reduce(
      (sum, o) => sum + parseFloat(o.total_price),
      0
    );
    const avgOrderValue =
      orders.length > 0 ? totalSpent / orders.length : 0;

    return {
      customer,
      orders,
      totalSpent,
      avgOrderValue,
    };
  }

  async getProductWithInventory(
    productId: string
  ): Promise<{
    product: ShopifyProduct;
    inventory: Array<{
      variantId: number;
      available: number;
    }>;
  }> {
    const product = await this.client.getProduct(productId);

    const inventoryItemIds = product.variants.map((v) =>
      v.inventory_item_id.toString()
    );

    let inventory: Array<{ variantId: number; available: number }> = [];

    if (inventoryItemIds.length > 0) {
      try {
        const levels = await this.client.getInventoryLevels({
          inventoryItemIds,
        });

        inventory = product.variants.map((v) => {
          const level = levels.find(
            (l) => l.inventory_item_id === v.inventory_item_id.toString()
          );
          return {
            variantId: v.id,
            available: level?.available ?? 0,
          };
        });
      } catch (error) {
        logger.warn('Failed to get inventory levels', {
          productId,
          error,
        });
      }
    }

    return { product, inventory };
  }

  async getOrdersByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<ShopifyOrder[]> {
    const allOrders: ShopifyOrder[] = [];
    let sinceId: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const orders = await this.client.getOrders({
        limit: 250,
        status: 'any',
        created_at_min: startDate.toISOString(),
        created_at_max: endDate.toISOString(),
        since_id: sinceId,
      });

      allOrders.push(...orders);

      if (orders.length < 250) {
        hasMore = false;
      } else {
        sinceId = orders[orders.length - 1].id.toString();
      }

      // Rate limiting protection
      await sleep(500);
    }

    return allOrders;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
