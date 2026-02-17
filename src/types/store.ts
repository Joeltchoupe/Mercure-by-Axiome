// src/types/store.ts

export interface Store {
  id: string;
  shopifyDomain: string;
  shopName: string;
  accessToken: string;
  email?: string;
  plan: StorePlan;
  settings: StoreSettings;
  installedAt: Date;
  uninstalledAt: Date | null;
  lastSyncAt: Date | null;
}

export type StorePlan = 'free' | 'starter' | 'growth' | 'scale' | 'enterprise';

export interface StoreSettings {
  timezone: string;
  currency: string;
  notificationEmail?: string;
  dailyLlmBudgetUsd?: number;
  monthlyLlmBudgetUsd?: number;
  autoSyncEnabled?: boolean;
  syncFrequencyMinutes?: number;
  webhookSecret?: string;
}

export interface DailyMetrics {
  date: string;
  revenue: number;
  orders: number;
  newCustomers: number;
  returningCustomers: number;
  avgOrderValue: number;
  conversionRate: number;
}

export interface AggregatedMetrics {
  revenue: number;
  orders: number;
  newCustomers: number;
  returningCustomers: number;
  avgOrderValue: number;
  conversionRate: number;
  agentActions: number;
}

export interface StorePlanLimits {
  maxAgents: number;
  maxEventsPerDay: number;
  maxLlmCostPerMonth: number;
  vectorStorageDocuments: number;
  retentionDays: number;
  integrationsAllowed: string[];
}

export const PLAN_LIMITS: Record<StorePlan, StorePlanLimits> = {
  free: {
    maxAgents: 2,
    maxEventsPerDay: 500,
    maxLlmCostPerMonth: 10,
    vectorStorageDocuments: 100,
    retentionDays: 7,
    integrationsAllowed: ['shopify'],
  },
  starter: {
    maxAgents: 3,
    maxEventsPerDay: 5000,
    maxLlmCostPerMonth: 50,
    vectorStorageDocuments: 1000,
    retentionDays: 30,
    integrationsAllowed: ['shopify', 'klaviyo'],
  },
  growth: {
    maxAgents: 5,
    maxEventsPerDay: 25000,
    maxLlmCostPerMonth: 200,
    vectorStorageDocuments: 10000,
    retentionDays: 90,
    integrationsAllowed: ['shopify', 'klaviyo', 'gorgias'],
  },
  scale: {
    maxAgents: 5,
    maxEventsPerDay: 100000,
    maxLlmCostPerMonth: 500,
    vectorStorageDocuments: 50000,
    retentionDays: 180,
    integrationsAllowed: ['shopify', 'klaviyo', 'gorgias'],
  },
  enterprise: {
    maxAgents: 5,
    maxEventsPerDay: -1, // unlimited
    maxLlmCostPerMonth: -1,
    vectorStorageDocuments: -1,
    retentionDays: 365,
    integrationsAllowed: ['shopify', 'klaviyo', 'gorgias'],
  },
};
