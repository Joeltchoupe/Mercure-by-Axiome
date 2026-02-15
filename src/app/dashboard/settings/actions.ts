// src/app/dashboard/settings/actions.ts

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { StoreRepo } from '@/data/repositories/store.repo';

export async function updateStoreSettings(formData: FormData) {
  const storeId = formData.get('storeId') as string;
  const timezone = formData.get('timezone') as string;
  const currency = formData.get('currency') as string;
  const notificationEmail = formData.get('notificationEmail') as string;

  if (!storeId) {
    throw new Error('Missing store ID');
  }

  const storeRepo = new StoreRepo();
  await storeRepo.updateSettings(storeId, {
    timezone,
    currency,
    notificationEmail,
  });

  revalidatePath('/dashboard/settings');
}

export async function updateBudget(formData: FormData) {
  const storeId = formData.get('storeId') as string;
  const dailyBudget = parseFloat(formData.get('dailyBudget') as string);
  const monthlyBudget = parseFloat(formData.get('monthlyBudget') as string);

  if (!storeId) {
    throw new Error('Missing store ID');
  }

  const storeRepo = new StoreRepo();
  await storeRepo.updateSettings(storeId, {
    dailyLlmBudgetUsd: isNaN(dailyBudget) ? undefined : dailyBudget,
    monthlyLlmBudgetUsd: isNaN(monthlyBudget) ? undefined : monthlyBudget,
  });

  revalidatePath('/dashboard/settings');
}

export async function uninstallApp(formData: FormData) {
  const storeId = formData.get('storeId') as string;

  if (!storeId) {
    throw new Error('Missing store ID');
  }

  const storeRepo = new StoreRepo();
  await storeRepo.markUninstalled(storeId);

  redirect('/install');
    }
