// src/types/memory.ts

export type VectorNamespace =
  | 'customer_profile'
  | 'product_description'
  | 'support_ticket'
  | 'agent_decision'
  | 'store_knowledge';

export interface VectorDocument {
  id: string;
  storeId: string;
  namespace: VectorNamespace;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface VectorSearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface VectorSearchParams {
  storeId: string;
  query: string;
  namespace?: VectorNamespace;
  limit?: number;
  minSimilarity?: number;
  filter?: Record<string, unknown>;
}

export interface MemoryStats {
  totalDocuments: number;
  byNamespace: Record<VectorNamespace, number>;
  estimatedStorageMb: number;
}
