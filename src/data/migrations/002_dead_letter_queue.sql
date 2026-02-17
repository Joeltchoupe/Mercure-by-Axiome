-- src/data/migrations/002_dead_letter_queue.sql

CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id VARCHAR(64) NOT NULL UNIQUE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  error TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dlq_store ON dead_letter_queue(store_id);
CREATE INDEX idx_dlq_unresolved ON dead_letter_queue(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_dlq_failed ON dead_letter_queue(failed_at DESC);
