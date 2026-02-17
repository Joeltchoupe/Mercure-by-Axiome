// src/types/store.ts

export interface Store {
  id: string;
  shopifyDomain: string;
  shopName: string;
  accessToken: string; // encrypted
  email?: string;
  plan: string;
  settings: StoreSettings;
  installedAt: Date;
  uninstalledAt: Date | null;
  lastSyncAt: Date | null;
}

export interface StoreSettings {
  timezone: string;
  currency: string;
  notificationEmail?: string;
  dailyLlmBudgetUsd?: number;
  monthlyLlmBudgetUsd?: number;
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
