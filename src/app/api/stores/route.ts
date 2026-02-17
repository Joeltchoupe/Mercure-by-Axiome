// src/app/api/stores/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStore } from '@/lib/auth';
import { StoreRepo } from '@/data/repositories/store.repo';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const store = await getAuthenticatedStore();

    if (!store) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      store: {
        id: store.id,
        shopifyDomain: store.shopifyDomain,
        shopName: store.shopName,
        plan: store.plan,
        settings: store.settings,
        installedAt: store.installedAt,
      },
    });
  } catch (error) {
    logger.error('GET /api/stores error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
