-- src/data/migrations/003_vector_store.sql

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE vector_documents (
  id VARCHAR(128) PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  namespace VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vector_docs_store ON vector_documents(store_id);
CREATE INDEX idx_vector_docs_namespace ON vector_documents(store_id, namespace);
CREATE INDEX idx_vector_docs_embedding ON vector_documents
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
