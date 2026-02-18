// src/app/dashboard/billing/page.tsx

import { Suspense } from 'react';
import { getAuthenticatedStore } from '@/lib/auth';
import { BillingService } from '@/core/billing/billing-service';
import { PLANS, PLAN_ORDER } from '@/config/billing.config';
import { PlanCard } from '@/components/dashboard/billing/plan-card';
import { CurrentPlanBanner } from '@/components/dashboard/billing/current-plan-banner';
import { UsagePanel } from '@/components/dashboard/billing/usage-panel';
import { BillingHistory } from '@/components/dashboard/billing/billing-history';
import { SkeletonCard } from '@/components/dashboard/skeleton-card';

export default async function BillingPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Billing</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Gérez votre abonnement et suivez votre usage.
        </p>
      </div>

      <Suspense fallback={<SkeletonCard className="h-24" />}>
        <CurrentPlanSection />
      </Suspense>

      <Suspense fallback={<SkeletonCard className="h-48" />}>
        <UsageSection />
      </Suspense>

      <Suspense fallback={<PlansGridSkeleton />}>
        <PlansSection />
      </Suspense>

      <Suspense fallback={<SkeletonCard className="h-40" />}>
        <HistorySection />
      </Suspense>
    </div>
  );
}

async function CurrentPlanSection() {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  const billingService = new BillingService();
  const status = await billingService.getSubscriptionStatus(store.id);

  return <CurrentPlanBanner status={status} />;
}

async function UsageSection() {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  const billingService = new BillingService();
  const status = await billingService.getSubscriptionStatus(store.id);

  if (!status.isActive || !status.usage || !status.plan) return null;

  return <UsagePanel usage={status.usage} plan={status.plan} />;
}

async function PlansSection() {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  const billingService = new BillingService();
  const status = await billingService.getSubscriptionStatus(store.id);

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-200 mb-4">Plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLAN_ORDER.map((planId) => (
          <PlanCard
            key={planId}
            plan={PLANS[planId]}
            currentPlan={status.plan}
            isActive={status.isActive}
            storeId={store.id}
          />
        ))}
      </div>
    </div>
  );
}

async function HistorySection() {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  const { SubscriptionRepo } = await import(
    '@/data/repositories/subscription.repo'
  );
  const repo = new SubscriptionRepo();
  const history = await repo.getByStoreId(store.id);

  return <BillingHistory subscriptions={history} />;
}

function PlansGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="h-80" />
      ))}
    </div>
  );
}
