// src/components/dashboard/billing/current-plan-banner.tsx

import { CreditCard, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLANS } from '@/config/billing.config';
import type { BillingPlan, Subscription, UsageMetrics } from '@/types/billing';

interface CurrentPlanBannerProps {
  status: {
    hasSubscription: boolean;
    subscription: Subscription | null;
    plan: BillingPlan | null;
    isActive: boolean;
    isTrial: boolean;
    trialDaysRemaining: number | null;
  };
}

export function CurrentPlanBanner({ status }: CurrentPlanBannerProps) {
  if (!status.hasSubscription) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-amber-400">
              Aucun abonnement actif
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Choisissez un plan pour activer vos agents IA.
              Tous les plans incluent 7 jours d'essai gratuit.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const plan = status.plan ? PLANS[status.plan] : null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            {status.isActive ? (
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            ) : (
              <Clock className="h-5 w-5 text-amber-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-50">
                {plan?.name ?? 'Unknown'} Plan
              </h2>
              {status.isTrial && (
                <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-medium">
                  TRIAL
                </span>
              )}
              <span
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium',
                  status.isActive
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-zinc-700 text-zinc-400'
                )}
              >
                {status.subscription?.status?.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">
              {plan
                ? `$${plan.priceUsd}/mois`
                : ''}
              {status.isTrial && status.trialDaysRemaining
                ? ` — ${status.trialDaysRemaining} jours d'essai restants`
                : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-zinc-500" />
          <span className="text-xs text-zinc-500">Via Shopify Billing</span>
        </div>
      </div>
    </div>
  );
}
