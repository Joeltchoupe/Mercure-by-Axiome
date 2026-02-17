// src/core/execution/tool-executor.ts

import { ShopifyClient } from '@/integrations/shopify/client';
import { KlaviyoClient } from '@/integrations/klaviyo/client';
import { GorgiasClient } from '@/integrations/gorgias/client';
import { IntegrationRepo } from '@/data/repositories/integration.repo';
import { decrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';

export type ToolName =
  | 'shopify.create_discount'
  | 'shopify.get_order'
  | 'shopify.get_customer'
  | 'shopify.get_products'
  | 'shopify.get_inventory'
  | 'klaviyo.add_to_list'
  | 'klaviyo.trigger_flow'
  | 'klaviyo.update_profile'
  | 'gorgias.create_ticket'
  | 'gorgias.add_note'
  | 'gorgias.tag_ticket';

export interface ToolCall {
  tool: ToolName;
  params: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  data: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

export class ToolExecutor {
  private integrationRepo: IntegrationRepo;

  constructor() {
    this.integrationRepo = new IntegrationRepo();
  }

  async execute(
    storeId: string,
    storeAccessToken: string,
    storeDomain: string,
    call: ToolCall
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const [provider] = call.tool.split('.') as [string, string];
      let result: Record<string, unknown>;

      switch (provider) {
        case 'shopify':
          result = await this.executeShopify(
            storeDomain,
            storeAccessToken,
            call
          );
          break;

        case 'klaviyo':
          result = await this.executeKlaviyo(storeId, call);
          break;

        case 'gorgias':
          result = await this.executeGorgias(storeId, call);
          break;

        default:
          throw new Error(`Unknown tool provider: ${provider}`);
      }

      const durationMs = Date.now() - startTime;

      logger.info('Tool executed', {
        tool: call.tool,
        storeId,
        durationMs,
      });

      return { success: true, data: result, durationMs };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      logger.error('Tool execution failed', {
        tool: call.tool,
        storeId,
        error,
        durationMs,
      });

      return {
        success: false,
        data: {},
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs,
      };
    }
  }

  private async executeShopify(
    storeDomain: string,
    accessToken: string,
    call: ToolCall
  ): Promise<Record<string, unknown>> {
    const client = new ShopifyClient(storeDomain, accessToken);
    const action = call.tool.split('.')[1];

    switch (action) {
      case 'create_discount': {
        const p = call.params;
        const discount = await client.createDiscount({
          title: (p.title as string) ?? `AXIO-${Date.now()}`,
          targetType: (p.targetType as 'line_item' | 'shipping_line') ?? 'line_item',
          valueType: (p.valueType as 'fixed_amount' | 'percentage') ?? 'percentage',
          value: (p.value as string) ?? '-10',
          customerSelection: (p.customerSelection as 'all' | 'prerequisite') ?? 'all',
          startsAt: (p.startsAt as string) ?? new Date().toISOString(),
          endsAt: p.endsAt as string | undefined,
          usageLimit: p.usageLimit as number | undefined,
          prerequisiteCustomerIds: p.customerIds as string[] | undefined,
        });
        return { discount };
      }

      case 'get_order': {
        const order = await client.getOrder(call.params.orderId as string);
        return { order };
      }

      case 'get_customer': {
        const customer = await client.getCustomer(
          call.params.customerId as string
        );
        return { customer };
      }

      case 'get_products': {
        const products = await client.getProducts({
          limit: (call.params.limit as number) ?? 50,
        });
        return { products };
      }

      case 'get_inventory': {
        const levels = await client.getInventoryLevels({
          inventoryItemIds: call.params.inventoryItemIds as string[],
        });
        return { levels };
      }

      default:
        throw new Error(`Unknown Shopify action: ${action}`);
    }
  }

  private async executeKlaviyo(
    storeId: string,
    call: ToolCall
  ): Promise<Record<string, unknown>> {
    const integration = await this.integrationRepo.getByProvider(
      storeId,
      'klaviyo'
    );

    if (!integration) {
      throw new Error('Klaviyo integration not connected');
    }

    const apiKey = decrypt(integration.accessToken);
    const client = new KlaviyoClient(apiKey);
    const action = call.tool.split('.')[1];

    switch (action) {
      case 'add_to_list': {
        await client.addProfileToList(
          call.params.listId as string,
          {
            email: call.params.email as string,
            firstName: call.params.firstName as string | undefined,
            lastName: call.params.lastName as string | undefined,
            properties: call.params.properties as Record<string, unknown> | undefined,
          }
        );
        return { added: true };
      }

      case 'trigger_flow': {
        await client.triggerFlow(
          call.params.flowId as string,
          {
            email: call.params.email as string,
            properties: call.params.properties as Record<string, unknown> | undefined,
          }
        );
        return { triggered: true };
      }

      case 'update_profile': {
        await client.updateProfile(
          call.params.email as string,
          call.params.properties as Record<string, unknown>
        );
        return { updated: true };
      }

      default:
        throw new Error(`Unknown Klaviyo action: ${action}`);
    }
  }

  private async executeGorgias(
    storeId: string,
    call: ToolCall
  ): Promise<Record<string, unknown>> {
    const integration = await this.integrationRepo.getByProvider(
      storeId,
      'gorgias'
    );

    if (!integration) {
      throw new Error('Gorgias integration not connected');
    }

    const apiKey = decrypt(integration.accessToken);
    const domain = integration.config.domain as string;

    if (!domain) {
      throw new Error('Gorgias domain not configured');
    }

    const client = new GorgiasClient(domain, apiKey);
    const action = call.tool.split('.')[1];

    switch (action) {
      case 'create_ticket': {
        const ticket = await client.createTicket({
          subject: call.params.subject as string,
          message: call.params.message as string,
          customerEmail: call.params.customerEmail as string,
          channel: (call.params.channel as string) ?? 'email',
          tags: call.params.tags as string[] | undefined,
        });
        return { ticket };
      }

      case 'add_note': {
        await client.addInternalNote(
          call.params.ticketId as number,
          call.params.note as string
        );
        return { added: true };
      }

      case 'tag_ticket': {
        await client.addTags(
          call.params.ticketId as number,
          call.params.tags as string[]
        );
        return { tagged: true };
      }

      default:
        throw new Error(`Unknown Gorgias action: ${action}`);
    }
  }

  getAvailableTools(): ToolName[] {
    return [
      'shopify.create_discount',
      'shopify.get_order',
      'shopify.get_customer',
      'shopify.get_products',
      'shopify.get_inventory',
      'klaviyo.add_to_list',
      'klaviyo.trigger_flow',
      'klaviyo.update_profile',
      'gorgias.create_ticket',
      'gorgias.add_note',
      'gorgias.tag_ticket',
    ];
  }
}
