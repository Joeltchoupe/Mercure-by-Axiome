// src/integrations/shopify/webhook-mapper.ts

import type { EventType } from '@/types/event';

const TOPIC_TO_EVENT_TYPE: Record<string, EventType> = {
  'orders/create': 'order.created',
  'orders/updated': 'order.updated',
  'orders/fulfilled': 'order.fulfilled',
  'orders/cancelled': 'order.cancelled',
  'checkouts/create': 'checkout.started',
  'checkouts/update': 'checkout.updated',
  'customers/create': 'customer.created',
  'customers/update': 'customer.updated',
  'carts/create': 'cart.created',
  'carts/update': 'cart.updated',
  'products/update': 'product.updated',
};

export function mapWebhookToEventType(topic: string): EventType | null {
  return TOPIC_TO_EVENT_TYPE[topic] ?? null;
}

export function mapEventTypeToTopic(eventType: EventType): string | null {
  const entry = Object.entries(TOPIC_TO_EVENT_TYPE).find(
    ([, type]) => type === eventType
  );
  return entry ? entry[0] : null;
}
