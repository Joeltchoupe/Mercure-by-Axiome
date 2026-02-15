// src/lib/auth.ts

import { cookies } from 'next/headers';
import { StoreRepo } from '@/data/repositories/store.repo';
import type { Store } from '@/types/store';

export async function getAuthenticatedStore(): Promise<Store | null> {
  const cookieStore = cookies();
  const storeId = cookieStore.get('store_id')?.value;

  if (!storeId) {
    return null;
  }

  const storeRepo = new StoreRepo();
  const store = await storeRepo.getById(storeId);

  if (!store || store.uninstalledAt) {
    return null;
  }

  return store;
}
