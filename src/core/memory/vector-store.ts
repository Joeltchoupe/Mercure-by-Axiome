// src/core/memory/vector-store.ts

import { db } from '@/data/db';
import { EmbeddingsClient } from '@/core/memory/embeddings';
import { logger } from '@/lib/logger';

export interface VectorDocument {
  id: string;
  storeId: string;
  namespace: VectorNamespace;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  createdAt: Date;
}

export type VectorNamespace =
  | 'customer_profile'
  | 'product_description'
  | 'support_ticket'
  | 'agent_decision'
  | 'store_knowledge';

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export class VectorStore {
  private embeddings: EmbeddingsClient;

  constructor() {
    this.embeddings = new EmbeddingsClient();
  }

  async upsert(params: {
    id: string;
    storeId: string;
    namespace: VectorNamespace;
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      // Generate embedding
      const embedding = await this.embeddings.embed(params.content);

      // Store in pgvector
      await db.query(
        `INSERT INTO vector_documents (id, store_id, namespace, content, metadata, embedding, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id)
         DO UPDATE SET
           content = EXCLUDED.content,
           metadata = EXCLUDED.metadata,
           embedding = EXCLUDED.embedding,
           updated_at = NOW()`,
        [
          params.id,
          params.storeId,
          params.namespace,
          params.content,
          JSON.stringify(params.metadata ?? {}),
          vectorToString(embedding),
        ]
      );
    } catch (error) {
      logger.error('Vector upsert failed', {
        id: params.id,
        namespace: params.namespace,
        error,
      });
      throw error;
    }
  }

  async upsertBatch(
    documents: Array<{
      id: string;
      storeId: string;
      namespace: VectorNamespace;
      content: string;
      metadata?: Record<string, unknown>;
    }>
  ): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;

    // Batch embed
    const contents = documents.map((d) => d.content);
    let embeddings: number[][];

    try {
      embeddings = await this.embeddings.embedBatch(contents);
    } catch (error) {
      logger.error('Batch embedding failed', { error });
      return { succeeded: 0, failed: documents.length };
    }

    // Insert individually (pgvector doesn't support bulk upsert cleanly)
    for (let i = 0; i < documents.length; i++) {
      try {
        await db.query(
          `INSERT INTO vector_documents (id, store_id, namespace, content, metadata, embedding, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (id)
           DO UPDATE SET
             content = EXCLUDED.content,
             metadata = EXCLUDED.metadata,
             embedding = EXCLUDED.embedding,
             updated_at = NOW()`,
          [
            documents[i].id,
            documents[i].storeId,
            documents[i].namespace,
            documents[i].content,
            JSON.stringify(documents[i].metadata ?? {}),
            vectorToString(embeddings[i]),
          ]
        );
        succeeded++;
      } catch (error) {
        failed++;
        logger.warn('Vector document insert failed', {
          id: documents[i].id,
          error,
        });
      }
    }

    return { succeeded, failed };
  }

  async search(params: {
    storeId: string;
    query: string;
    namespace?: VectorNamespace;
    limit?: number;
    minSimilarity?: number;
  }): Promise<SearchResult[]> {
    try {
      // Embed query
      const queryEmbedding = await this.embeddings.embed(params.query);

      const conditions = ['store_id = $1'];
      const values: unknown[] = [params.storeId];
      let paramIndex = 2;

      if (params.namespace) {
        conditions.push(`namespace = $${paramIndex}`);
        values.push(params.namespace);
        paramIndex++;
      }

      const limit = params.limit ?? 10;
      const minSimilarity = params.minSimilarity ?? 0.7;

      const result = await db.query<{
        id: string;
        content: string;
        metadata: Record<string, unknown>;
        similarity: number;
      }>(
        `SELECT
           id,
           content,
           metadata,
           1 - (embedding <=> $${paramIndex}) as similarity
         FROM vector_documents
         WHERE ${conditions.join(' AND ')}
           AND 1 - (embedding <=> $${paramIndex}) >= $${paramIndex + 1}
         ORDER BY embedding <=> $${paramIndex}
         LIMIT $${paramIndex + 2}`,
        [...values, vectorToString(queryEmbedding), minSimilarity, limit]
      );

      return result.rows.map((row) => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata,
        similarity: row.similarity,
      }));
    } catch (error) {
      logger.error('Vector search failed', {
        storeId: params.storeId,
        namespace: params.namespace,
        error,
      });
      return [];
    }
  }

  async searchByNamespace(
    storeId: string,
    namespace: VectorNamespace,
    query: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    return this.search({ storeId, query, namespace, limit });
  }

  async delete(id: string): Promise<void> {
    await db.query('DELETE FROM vector_documents WHERE id = $1', [id]);
  }

  async deleteByNamespace(
    storeId: string,
    namespace: VectorNamespace
  ): Promise<number> {
    const result = await db.query(
      'DELETE FROM vector_documents WHERE store_id = $1 AND namespace = $2',
      [storeId, namespace]
    );
    return result.rowCount ?? 0;
  }

  async deleteByStore(storeId: string): Promise<number> {
    const result = await db.query(
      'DELETE FROM vector_documents WHERE store_id = $1',
      [storeId]
    );
    return result.rowCount ?? 0;
  }

  async getDocumentCount(
    storeId: string,
    namespace?: VectorNamespace
  ): Promise<number> {
    const conditions = ['store_id = $1'];
    const values: unknown[] = [storeId];

    if (namespace) {
      conditions.push('namespace = $2');
      values.push(namespace);
    }

    const result = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM vector_documents WHERE ${conditions.join(' AND ')}`,
      values
    );

    return parseInt(result.rows[0].count, 10);
  }
}

// ─── Helpers ───

function vectorToString(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
