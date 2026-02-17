// src/data/repositories/integration.repo.ts

import { db } from '@/data/db';
import type { Integration, IntegrationProvider } from '@/types/integration';

interface IntegrationRow {
  id: string;
  store_id: string;
  provider: IntegrationProvider;
  access_token: string | null;
  refresh_token: string | null;
  config: Record<string, unknown>;
  connected_at: Date;
  updated_at: Date;
}

function rowToIntegration(row: IntegrationRow): Integration {
  return {
    id: row.id,
    storeId: row.store_id,
    provider: row.provider,
    accessToken: row.access_token ?? '',
    refreshToken: row.refresh_token ?? undefined,
    config: row.config,
    connectedAt: row.connected_at,
  };
}

export class IntegrationRepo {
  async getByStoreId(storeId: string): Promise<Integration[]> {
    const result = await db.query<IntegrationRow>(
      'SELECT * FROM integrations WHERE store_id = $1 ORDER BY connected_at ASC',
      [storeId]
    );

    return result.rows.map(rowToIntegration);
  }

  async getByProvider(
    storeId: string,
    provider: IntegrationProvider
  ): Promise<Integration | null> {
    const result = await db.query<IntegrationRow>(
      'SELECT * FROM integrations WHERE store_id = $1 AND provider = $2',
      [storeId, provider]
    );

    if (result.rows.length === 0) return null;
    return rowToIntegration(result.rows[0]);
  }

  async upsert(params: {
    storeId: string;
    provider: IntegrationProvider;
    accessToken: string;
    refreshToken?: string;
    config?: Record<string, unknown>;
  }): Promise<Integration> {
    const result = await db.query<IntegrationRow>(
      `INSERT INTO integrations (store_id, provider, access_token, refresh_token, config)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (store_id, provider)
       DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = COALESCE(EXCLUDED.refresh_token, integrations.refresh_token),
         config = integrations.config || COALESCE(EXCLUDED.config, '{}'::jsonb),
         updated_at = NOW()
       RETURNING *`,
      [
        params.storeId,
        params.provider,
        params.accessToken,
        params.refreshToken ?? null,
        JSON.stringify(params.config ?? {}),
      ]
    );

    return rowToIntegration(result.rows[0]);
  }

  async delete(storeId: string, provider: IntegrationProvider): Promise<void> {
    await db.query(
      'DELETE FROM integrations WHERE store_id = $1 AND provider = $2',
      [storeId, provider]
    );
  }

  async deleteAllForStore(storeId: string): Promise<void> {
    await db.query(
      'DELETE FROM integrations WHERE store_id = $1',
      [storeId]
    );
  }
}
