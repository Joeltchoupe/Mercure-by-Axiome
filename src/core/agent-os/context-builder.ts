// src/core/agent-os/context-builder.ts

import { StoreRepo } from '@/data/repositories/store.repo';
import { CustomerRepo } from '@/data/repositories/customer.repo';
import { OrderRepo } from '@/data/repositories/order.repo';
import { EventRepo } from '@/data/repositories/event.repo';
import { AgentConfigRepo } from '@/data/repositories/agent-config.repo';
import { decrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';
import type { AgentEvent } from '@/types/event';
import type { Store } from '@/types/store';

export interface AgentContext {
  store: Store;
  event: AgentEvent;
  customer: {
    id: string | null;
    shopifyId: string | null;
    email: string | null;
    totalOrders: number;
    totalSpent: number;
    daysSinceLastOrder: number | null;
    isRepeatBuyer: boolean;
    tags: string[];
  } | null;
  recentEvents: AgentEvent[];
  recentOrders: Array<{
    totalPrice: number;
    createdAt: Date | null;
    lineItems: unknown[];
  }>;
  storeAccessToken: string;
  agentConfigs: Record<string, unknown>;
}

export class ContextBuilder {
  private storeRepo: StoreRepo;
  private customerRepo: CustomerRepo;
  private orderRepo: OrderRepo;
  private eventRepo: EventRepo;
  private agentConfigRepo: AgentConfigRepo;

  constructor() {
    this.storeRepo = new StoreRepo();
    this.customerRepo = new CustomerRepo();
    this.orderRepo = new OrderRepo();
    this.eventRepo = new EventRepo();
    this.agentConfigRepo = new AgentConfigRepo();
  }

  async build(event: AgentEvent): Promise<AgentContext> {
    // 1. Get store
    const store = await this.storeRepo.getById(event.storeId);

    if (!store) {
      throw new Error(`Store not found: ${event.storeId}`);
    }

    // 2. Extract customer info from payload
    const customerEmail = this.extractEmail(event.payload);
    const shopifyCustomerId = this.extractCustomerId(event.payload);

    // 3. Build customer context
    let customerContext: AgentContext['customer'] = null;

    if (shopifyCustomerId || customerEmail) {
      const customer = shopifyCustomerId
        ? await this.customerRepo.getByShopifyId(
            event.storeId,
            shopifyCustomerId
          )
        : customerEmail
          ? await this.customerRepo.getByEmail(event.storeId, customerEmail)
          : null;

      if (customer) {
        const now = new Date();
        const daysSinceLastOrder = customer.lastOrderAt
          ? Math.floor(
              (now.getTime() - customer.lastOrderAt.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null;

        customerContext = {
          id: customer.id,
          shopifyId: customer.shopifyCustomerId,
          email: customer.email,
          totalOrders: customer.totalOrders,
          totalSpent: customer.totalSpent,
          daysSinceLastOrder,
          isRepeatBuyer: customer.totalOrders > 1,
          tags: customer.tags,
        };
      }
    }

    // 4. Get recent events for this customer
    let recentEvents: AgentEvent[] = [];
    if (customerEmail) {
      recentEvents = await this.eventRepo.getRecentEventsForCustomer(
        event.storeId,
        customerEmail,
        20
      );
    }

    // 5. Get recent orders
    let recentOrders: AgentContext['recentOrders'] = [];
    if (shopifyCustomerId) {
      const orders = await this.orderRepo.getCustomerOrders(
        event.storeId,
        shopifyCustomerId
      );

      recentOrders = orders.slice(0, 10).map((o) => ({
        totalPrice: o.totalPrice,
        createdAt: o.shopifyCreatedAt,
        lineItems: o.lineItems,
      }));
    }

    // 6. Decrypt store access token
    let storeAccessToken = '';
    try {
      storeAccessToken = decrypt(store.accessToken);
    } catch (error) {
      logger.error('Failed to decrypt store access token', {
        storeId: store.id,
      });
    }

    // 7. Get agent configs
    const configs = await this.agentConfigRepo.getAllConfigs(event.storeId);
    const agentConfigs: Record<string, unknown> = {};
    for (const config of configs) {
      agentConfigs[config.agentType] = {
        enabled: config.enabled,
        maxActionsPerHour: config.maxActionsPerHour,
        llmModel: config.llmModel,
        maxCostPerDayUsd: config.maxCostPerDayUsd,
      };
    }

    return {
      store,
      event,
      customer: customerContext,
      recentEvents,
      recentOrders,
      storeAccessToken,
      agentConfigs,
    };
  }

  private extractEmail(payload: Record<string, unknown>): string | null {
    if (typeof payload.email === 'string') return payload.email;
    if (
      payload.customer &&
      typeof payload.customer === 'object' &&
      'email' in (payload.customer as Record<string, unknown>)
    ) {
      return (payload.customer as Record<string, unknown>).email as string;
    }
    return null;
  }

  private extractCustomerId(
    payload: Record<string, unknown>
  ): string | null {
    if (
      payload.customer &&
      typeof payload.customer === 'object' &&
      'id' in (payload.customer as Record<string, unknown>)
    ) {
      return String(
        (payload.customer as Record<string, unknown>).id
      );
    }
    return null;
  }
  }
