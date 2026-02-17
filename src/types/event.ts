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

export interface EventFilter {
  type?: EventType;
  source?: EventSource;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

export interface EventStats {
  type: EventType;
  count: number;
  lastReceivedAt: Date | null;
}

// ─── Webhook mapping ───

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  'order.created': 'Order Created',
  'order.updated': 'Order Updated',
  'order.fulfilled': 'Order Fulfilled',
  'order.cancelled': 'Order Cancelled',
  'checkout.started': 'Checkout Started',
  'checkout.updated': 'Checkout Updated',
  'checkout.completed': 'Checkout Completed',
  'customer.created': 'Customer Created',
  'customer.updated': 'Customer Updated',
  'cart.created': 'Cart Created',
  'cart.updated': 'Cart Updated',
  'product.viewed': 'Product Viewed',
  'product.updated': 'Product Updated',
  'support.ticket.created': 'Support Ticket Created',
  'support.ticket.resolved': 'Support Ticket Resolved',
};

export const EVENT_TYPE_CATEGORIES: Record<EventType, string> = {
  'order.created': 'orders',
  'order.updated': 'orders',
  'order.fulfilled': 'orders',
  'order.cancelled': 'orders',
  'checkout.started': 'checkout',
  'checkout.updated': 'checkout',
  'checkout.completed': 'checkout',
  'customer.created': 'customers',
  'customer.updated': 'customers',
  'cart.created': 'cart',
  'cart.updated': 'cart',
  'product.viewed': 'products',
  'product.updated': 'products',
  'support.ticket.created': 'support',
  'support.ticket.resolved': 'support',
};
