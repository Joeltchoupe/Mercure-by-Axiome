// src/config/billing.config.ts

import type { BillingPlan, PlanDetails } from '@/types/billing';

export const PLANS: Record<BillingPlan, PlanDetails> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceUsd: 49,
    trialDays: 7,
    description: 'Pour les stores qui démarrent avec l\'IA. Les fondamentaux.',
    features: [
      '3 agents actifs (Conversion, Retention, Support)',
      '5 000 events/jour',
      '$50/mois de budget LLM inclus',
      '1 000 documents mémoire',
      '30 jours de rétention données',
      'Intégration Shopify',
      'Support email',
    ],
    limits: {
      maxAgents: 3,
      maxEventsPerDay: 5_000,
      maxLlmCostPerMonthUsd: 50,
      vectorDocuments: 1_000,
      retentionDays: 30,
      integrations: ['shopify'],
      supportLevel: 'email',
    },
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    priceUsd: 149,
    trialDays: 7,
    description: 'Pour les stores en croissance. Le stack complet.',
    recommended: true,
    features: [
      '5 agents actifs (tous)',
      '25 000 events/jour',
      '$200/mois de budget LLM inclus',
      '10 000 documents mémoire',
      '90 jours de rétention données',
      'Shopify + Klaviyo + Gorgias',
      'Support prioritaire',
      'Dashboard avancé',
    ],
    limits: {
      maxAgents: 5,
      maxEventsPerDay: 25_000,
      maxLlmCostPerMonthUsd: 200,
      vectorDocuments: 10_000,
      retentionDays: 90,
      integrations: ['shopify', 'klaviyo', 'gorgias'],
      supportLevel: 'email',
    },
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    priceUsd: 499,
    trialDays: 7,
    description: 'Pour les stores qui dominent. Puissance maximale.',
    features: [
      '5 agents actifs (tous)',
      '100 000 events/jour',
      '$500/mois de budget LLM inclus',
      '50 000 documents mémoire',
      '180 jours de rétention données',
      'Toutes les intégrations',
      'Support prioritaire dédié',
      'Dashboard avancé',
      'API access',
      'Custom agent rules',
    ],
    limits: {
      maxAgents: 5,
      maxEventsPerDay: 100_000,
      maxLlmCostPerMonthUsd: 500,
      vectorDocuments: 50_000,
      retentionDays: 180,
      integrations: ['shopify', 'klaviyo', 'gorgias'],
      supportLevel: 'priority',
    },
  },
};

export const PLAN_ORDER: BillingPlan[] = ['starter', 'growth', 'scale'];

export function getPlan(planId: BillingPlan): PlanDetails {
  const plan = PLANS[planId];
  if (!plan) throw new Error(`Unknown plan: ${planId}`);
  return plan;
}

export function isValidPlan(value: string): value is BillingPlan {
  return PLAN_ORDER.includes(value as BillingPlan);
}

export function isUpgrade(currentPlan: BillingPlan, newPlan: BillingPlan): boolean {
  return PLAN_ORDER.indexOf(newPlan) > PLAN_ORDER.indexOf(currentPlan);
}

export function isDowngrade(currentPlan: BillingPlan, newPlan: BillingPlan): boolean {
  return PLAN_ORDER.indexOf(newPlan) < PLAN_ORDER.indexOf(currentPlan);
}

export function canUsePlanFeature(
  plan: BillingPlan,
  feature: keyof PlanDetails['limits'],
  currentUsage?: number
): boolean {
  const limits = PLANS[plan].limits;
  const limit = limits[feature];

  if (typeof limit === 'number' && limit === -1) return true; // unlimited
  if (typeof limit === 'number' && currentUsage !== undefined) {
    return currentUsage < limit;
  }

  return true;
}
