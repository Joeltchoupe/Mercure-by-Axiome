// src/data/repositories/store.repo.ts

import { db } from '@/data/db';
import { logger } from '@/lib/logger';
import type { Store, StoreSettings } from '@/types/store';

interface StoreRow {
  id: string;
  shopify_domain: string;
  shop_name: string;
  access_token: string;
  email: string | null;
  plan: string;
  settings: StoreSettings;
  installed_at: Date;
  uninstalled_at: Date | null;
  last_sync_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function rowToStore(row: StoreRow): Store {
  return {
    id: row.id,
    shopifyDomain: row.shopify_domain,
    shopName: row.shop_name,
    accessToken: row.access_token,
    email: row.email ?? undefined,
    plan: row.plan,
    settings: row.settings ?? {},
    installedAt: row.installed_at,
    uninstalledAt: row.uninstalled_at,
    lastSyncAt: row.last_sync_at,
  };
}

export class StoreRepo {
  async getById(id: string): Promise<Store | null> {
    const result = await db.query<StoreRow>(
      'SELECT * FROM stores WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return null;
    return rowToStore(result.rows[0]);
  }

  async getByDomain(shopifyDomain: string): Promise<Store | null> {
    const result = await db.query<StoreRow>(
      'SELECT * FROM stores WHERE shopify_domain = $1',
      [shopifyDomain]
    );

    if (result.rows.length === 0) return null;
    return rowToStore(result.rows[0]);
  }

  async upsertOnInstall(params: {
    shopifyDomain: string;
    accessToken: string;
    shopName: string;
    email: string;
    plan: string;
    settings: StoreSettings;
  }): Promise<Store> {
    const result = await db.query<StoreRow>(
      `INSERT INTO stores (shopify_domain, access_token, shop_name, email, plan, settings, installed_at, uninstalled_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NULL)
       ON CONFLICT (shopify_domain)
       DO UPDATE SET
         access_token = EXCLUDED.access_token,
         shop_name = EXCLUDED.shop_name,
         email = EXCLUDED.email,
         settings = stores.settings || EXCLUDED.settings,
         uninstalled_at = NULL,
         updated_at = NOW()
       RETURNING *`,
      [
        params.shopifyDomain,
        params.accessToken,
        params.shopName,
        params.email,
        params.plan,
        JSON.stringify(params.settings),
      ]
    );

    return rowToStore(result.rows[0]);
  }

  async updateSettings(
    storeId: string,
    settings: Partial<StoreSettings>
  ): Promise<Store | null> {
    // Merge with existing settings
    const result = await db.query<StoreRow>(
      `UPDATE stores
       SET settings = settings || $2::jsonb
       WHERE id = $1
       RETURNING *`,
      [storeId, JSON.stringify(settings)]
    );

    if (result.rows.length === 0) return null;
    return rowToStore(result.rows[0]);
  }

  async updateLastSyncAt(storeId: string): Promise<void> {
    await db.query(
      'UPDATE stores SET last_sync_at = NOW() WHERE id = $1',
      [storeId]
    );
  }

  async markUninstalled(storeId: string): Promise<void> {
    await db.query(
      'UPDATE stores SET uninstalled_at = NOW() WHERE id = $1',
      [storeId]
    );

    logger.info('Store marked as uninstalled', { storeId });
  }

  async markUninstalledByDomain(shopifyDomain: string): Promise<void> {
    await db.query(
      'UPDATE stores SET uninstalled_at = NOW() WHERE shopify_domain = $1',
      [shopifyDomain]
    );

    logger.info('Store marked as uninstalled by domain', { shopifyDomain });
  }

  async getActiveStores(): Promise<Store[]> {
    const result = await db.query<StoreRow>(
      'SELECT * FROM stores WHERE uninstalled_at IS NULL ORDER BY installed_at DESC'
    );

    return result.rows.map(rowToStore);
  }

  async getStoreCount(): Promise<{ total: number; active: number }> {
    const result = await db.query<{ total: string; active: string }>(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE uninstalled_at IS NULL) as active
       FROM stores`
    );

    return {
      total: parseInt(result.rows[0].total, 10),
      active: parseInt(result.rows[0].active, 10),
    };
  }
}
