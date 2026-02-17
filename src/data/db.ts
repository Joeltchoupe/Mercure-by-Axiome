// src/data/db.ts

import { Pool, QueryResult, QueryResultRow } from 'pg';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected pool error', { error: err });
    });
  }

  return pool;
}

export const db = {
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    const p = getPool();

    try {
      const result = await p.query<T>(text, params);
      const duration = Date.now() - start;

      if (duration > 1000) {
        logger.warn('Slow query detected', {
          text: text.substring(0, 100),
          duration,
          rows: result.rowCount,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Query error', {
        text: text.substring(0, 100),
        duration,
        error,
      });
      throw error;
    }
  },

  async transaction<T>(
    fn: (query: typeof db.query) => Promise<T>
  ): Promise<T> {
    const p = getPool();
    const client = await p.connect();

    try {
      await client.query('BEGIN');

      const boundQuery = async <R extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: unknown[]
      ): Promise<QueryResult<R>> => {
        return client.query<R>(text, params);
      };

      const result = await fn(boundQuery as typeof db.query);

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async healthCheck(): Promise<boolean> {
    try {
      await db.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  },
};
