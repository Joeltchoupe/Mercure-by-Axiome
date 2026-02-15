// src/app/dashboard/settings/page.tsx

import { Suspense } from 'react';
import { getAuthenticatedStore } from '@/lib/auth';
import { StoreRepo } from '@/data/repositories/store.repo';
import { IntegrationRepo } from '@/data/repositories/integration.repo';
import { StoreSettingsForm } from '@/components/dashboard/store-settings-form';
import { IntegrationsPanel } from '@/components/dashboard/integrations-panel';
import { BudgetPanel } from '@/components/dashboard/budget-panel';
import { DangerZone } from '@/components/dashboard/danger-zone';
import { SkeletonCard } from '@/components/dashboard/skeleton-card';

export default async function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Configuration de votre store et de vos agents.
        </p>
      </div>

      <Suspense fallback={<SkeletonCard className="h-48" />}>
        <StoreSection />
      </Suspense>

      <Suspense fallback={<SkeletonCard className="h-64" />}>
        <IntegrationsSection />
      </Suspense>

      <Suspense fallback={<SkeletonCard className="h-48" />}>
        <BudgetSection />
      </Suspense>

      <Suspense fallback={<SkeletonCard className="h-32" />}>
        <DangerSection />
      </Suspense>
    </div>
  );
}

async function StoreSection() {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  return <StoreSettingsForm store={store} />;
}

async function IntegrationsSection() {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  const integrationRepo = new IntegrationRepo();
  const integrations = await integrationRepo.getByStoreId(store.id);

  return <IntegrationsPanel integrations={integrations} storeId={store.id} />;
}

async function BudgetSection() {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  return <BudgetPanel store={store} />;
}

async function DangerSection() {
  const store = await getAuthenticatedStore();
  if (!store) return null;

  return <DangerZone storeId={store.id} />;
}
