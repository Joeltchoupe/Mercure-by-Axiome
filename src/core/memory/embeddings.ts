// src/core/memory/embeddings.ts

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const MAX_BATCH_SIZE = 100;
const COST_PER_1M_TOKENS = 0.02;

export class EmbeddingsClient {
  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY required for embeddings');

    // Clean and truncate texts
    const cleanedTexts = texts.map((t) => cleanTextForEmbedding(t));

    // Process in chunks
    const allEmbeddings: number[][] = [];
    const chunks = chunkArray(cleanedTexts, MAX_BATCH_SIZE);

    for (const chunk of chunks) {
      const startTime = Date.now();

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: chunk,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
      });

      if (!response.ok) {
        const error = await response.text();

        if (response.status === 429) {
          const retryAfter = parseFloat(
            response.headers.get('retry-after') ?? '5'
          );
          await sleep(retryAfter * 1000);
          // Retry this chunk
          const retryResult = await this.embedBatch(chunk);
          allEmbeddings.push(...retryResult);
          continue;
        }

        throw new Error(
          `Embedding API error ${response.status}: ${error.substring(0, 200)}`
        );
      }

      const data = await response.json();
      const durationMs = Date.now() - startTime;

      const tokensUsed = data.usage?.total_tokens ?? 0;
      const costUsd = (tokensUsed * COST_PER_1M_TOKENS) / 1_000_000;

      logger.debug('Embeddings generated', {
        count: chunk.length,
        tokensUsed,
        costUsd: costUsd.toFixed(6),
        durationMs,
      });

      // Sort by index to maintain order
      const sorted = (data.data as Array<{ index: number; embedding: number[] }>)
        .sort((a, b) => a.index - b.index);

      for (const item of sorted) {
        allEmbeddings.push(item.embedding);
      }
    }

    return allEmbeddings;
  }

  getDimensions(): number {
    return EMBEDDING_DIMENSIONS;
  }

  getModel(): string {
    return EMBEDDING_MODEL;
  }

  estimateCost(textCount: number, avgTokensPerText: number = 100): number {
    return (textCount * avgTokensPerText * COST_PER_1M_TOKENS) / 1_000_000;
  }
}

// ─── Helpers ───

function cleanTextForEmbedding(text: string): string {
  // Remove excessive whitespace
  let cleaned = text.replace(/\s+/g, ' ').trim();

  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, ' ');

  // Truncate to ~8000 tokens (~32000 chars)
  if (cleaned.length > 32000) {
    cleaned = cleaned.substring(0, 32000);
  }

  return cleaned;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
