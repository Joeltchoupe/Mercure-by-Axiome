// src/types/event.ts

export type EventType =
  | 'order.created'
  | 'order.updated'
  | 'order.fulfilled'
  | 'order.cancelled'
  | 'checkout.started'
  | 'checkout.updated'
  | 'checkout.completed'
  | 'customer.created'
  | 'customer.updated'
  | 'cart.created'
  | 'cart.updated'
  | 'product.viewed'
  | 'product.updated'
  | 'support.ticket.created'
  | 'support.ticket.resolved';

export type EventSource = 'shopify' | 'klaviyo' | 'gorgias' | 'internal';

export interface AgentEvent {
  id: string;
  storeId: string;
  shopifyEventId: string | null;
  type: EventType;
  source: EventSource;
  payload: Record<string, unknown>;
  receivedAt: Date;
  processedAt?: Date;
}
