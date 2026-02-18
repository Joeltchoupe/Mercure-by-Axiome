// src/components/dashboard/billing/plan-card.tsx

'use client';

import { useState } from 'react';
import { Check, Star, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanDetails, BillingPlan } from '@/types/billing';

interface PlanCardProps {
  plan: PlanDetails;
  currentPlan: BillingPlan | null;
  isActive: boolean;
  storeId: string;
}

export function PlanCard({
  plan,
  currentPlan,
  isActive,
  storeId,
}: PlanCardProps) {
  const [loading, setLoading] = useState(false);
  const isCurrent = currentPlan === plan.id && isActive;
  const isRecommended = plan.recommended;

  async function handleSubscribe() {
    setLoading(true);

    try {
      const endpoint = currentPlan && isActive
        ? '/api/billing/change'
        : '/api/billing/create';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.id }),
      });

      const data = await response.json();

      if (data.confirmationUrl) {
        // Redirect to Shopify billing approval
        window.top
          ? (window.top.location.href = data.confirmationUrl)
          : (window.location.href = data.confirmationUrl);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        'relative bg-zinc-900 border rounded-xl p-6 flex flex-col',
        isCurrent
          ? 'border-emerald-500/50'
          : isRecommended
            ? 'border-amber-500/50'
            : 'border-zinc-800'
      )}
    >
      {/* Recommended badge */}
      {isRecommended && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-amber-500 text-zinc-950 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
            <Star className="h-3 w-3" />
            RECOMMENDED
          </span>
        </div>
      )}

      {/* Current badge */}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-emerald-500 text-zinc-950 text-[10px] font-bold px-3 py-1 rounded-full">
            CURRENT PLAN
          </span>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-6 mt-2">
        <h3 className="text-lg font-bold text-zinc-100">{plan.name}</h3>
        <div className="mt-2">
          <span className="text-3xl font-bold text-zinc-50">
            ${plan.priceUsd}
          </span>
          <span className="text-sm text-zinc-500">/mois</span>
        </div>
        <p className="text-xs text-zinc-500 mt-2">{plan.description}</p>
        {plan.trialDays > 0 && !isCurrent && (
          <p className="text-xs text-amber-500 mt-1">
            {plan.trialDays} jours d'essai gratuit
          </p>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-2.5 flex-1">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-zinc-400">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="mt-6">
        {isCurrent ? (
          <button
            disabled
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-500 cursor-not-allowed"
          >
            Plan actuel
          </button>
        ) : (
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className={cn(
              'w-full py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2',
              isRecommended
                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirection...
              </>
            ) : currentPlan && isActive ? (
              'Changer de plan'
            ) : (
              'Commencer l\'essai gratuit'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
