// src/types/billing.ts

export type BillingPlan = 'starter' | 'growth' | 'scale';

export type SubscriptionStatus =
  | 'pending'
  | 'active'
  | 'frozen'
  | 'cancelled'
  | 'declined'
  | 'expired';

export interface Subscription {
  id: string;
  storeId: string;
  shopifyChargeId: string;
  plan: BillingPlan;
  status: SubscriptionStatus;
  priceUsd: number;
  trialDays: number;
  trialEndsAt: Date | null;
  activatedAt: Date | null;
  cancelledAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  confirmationUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanDetails {
  id: BillingPlan;
  name: string;
  priceUsd: number;
  trialDays: number;
  description: string;
  features: string[];
  limits: PlanLimits;
  recommended?: boolean;
}

export interface PlanLimits {
  maxAgents: number;
  maxEventsPerDay: number;
  maxLlmCostPerMonthUsd: number;
  vectorDocuments: number;
  retentionDays: number;
  integrations: string[];
  supportLevel: 'community' | 'email' | 'priority';
}

export interface UsageMetrics {
  eventsToday: number;
  eventsThisMonth: number;
  llmCostToday: number;
  llmCostThisMonth: number;
  vectorDocuments: number;
  activeAgents: number;
}

export interface BillingEvent {
  type: 'subscription.created' | 'subscription.activated' | 'subscription.cancelled' | 'subscription.updated';
  storeId: string;
  plan: BillingPlan;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
