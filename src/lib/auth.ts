// src/lib/auth.ts

import { cookies } from 'next/headers';
import { StoreRepo } from '@/data/repositories/store.repo';
import { logger } from '@/lib/logger';
import type { Store } from '@/types/store';

const STORE_CACHE = new Map<string, { store: Store; cachedAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

export async function getAuthenticatedStore(): Promise<Store | null> {
  try {
    const cookieStore = cookies();
    const storeId = cookieStore.get('store_id')?.value;

    if (!storeId) {
      return null;
    }

    // Check memory cache
    const cached = STORE_CACHE.get(storeId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      if (!cached.store.uninstalledAt) {
        return cached.store;
      }
    }

    // Fetch from DB
    const storeRepo = new StoreRepo();
    const store = await storeRepo.getById(storeId);

    if (!store || store.uninstalledAt) {
      STORE_CACHE.delete(storeId);
      return null;
    }

    // Update cache
    STORE_CACHE.set(storeId, { store, cachedAt: Date.now() });

    return store;
  } catch (error) {
    logger.error('Auth check failed', { error });
    return null;
  }
}

export function clearAuthCache(storeId: string): void {
  STORE_CACHE.delete(storeId);
}

export function clearAllAuthCache(): void {
  STORE_CACHE.clear();
}

export async function requireAuthenticatedStore(): Promise<Store> {
  const store = await getAuthenticatedStore();

  if (!store) {
    throw new Error('Authentication required');
  }

  return store;
}

export async function verifyInternalApiKey(
  authHeader: string | null
): Promise<boolean> {
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) return false;

  const { env } = await import('@/lib/env');
  return token === env.INTERNAL_API_KEY;
}
