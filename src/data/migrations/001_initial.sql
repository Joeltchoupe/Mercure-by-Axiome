-- src/data/migrations/001_initial.sql

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════
-- STORES
-- ═══════════════════════════════════════════════

CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shopify_domain VARCHAR(255) NOT NULL UNIQUE,
  shop_name VARCHAR(255),
  access_token TEXT NOT NULL,
  email VARCHAR(255),
  plan VARCHAR(50) NOT NULL DEFAULT 'free',
  settings JSONB NOT NULL DEFAULT '{}',
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uninstalled_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stores_shopify_domain ON stores(shopify_domain);
CREATE INDEX idx_stores_plan ON stores(plan);

-- ═══════════════════════════════════════════════
-- CUSTOMERS
-- ═══════════════════════════════════════════════

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  shopify_customer_id VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spent DECIMAL(12, 2) NOT NULL DEFAULT 0,
  first_order_at TIMESTAMPTZ,
  last_order_at TIMESTAMPTZ,
  tags JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, shopify_customer_id)
);

CREATE INDEX idx_customers_store_id ON customers(store_id);
CREATE INDEX idx_customers_email ON customers(store_id, email);
CREATE INDEX idx_customers_shopify_id ON customers(store_id, shopify_customer_id);
CREATE INDEX idx_customers_total_spent ON customers(store_id, total_spent DESC);

-- ═══════════════════════════════════════════════
-- ORDERS
-- ═══════════════════════════════════════════════

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  shopify_order_id VARCHAR(50) NOT NULL,
  shopify_customer_id VARCHAR(50),
  email VARCHAR(255),
  total_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  subtotal_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_discounts DECIMAL(12, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
  financial_status VARCHAR(50),
  fulfillment_status VARCHAR(50),
  line_items JSONB NOT NULL DEFAULT '[]',
  source_name VARCHAR(100),
  referring_site TEXT,
  shopify_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, shopify_order_id)
);

CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_orders_customer ON orders(store_id, shopify_customer_id);
CREATE INDEX idx_orders_created ON orders(store_id, shopify_created_at DESC);
CREATE INDEX idx_orders_financial_status ON orders(store_id, financial_status);

-- ═══════════════════════════════════════════════
-- EVENTS
-- ═══════════════════════════════════════════════

CREATE TABLE events (
  id VARCHAR(64) PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  shopify_event_id VARCHAR(100),
  type VARCHAR(50) NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'shopify',
  payload JSONB NOT NULL DEFAULT '{}',
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_events_store_id ON events(store_id);
CREATE INDEX idx_events_type ON events(store_id, type);
CREATE INDEX idx_events_received ON events(store_id, received_at DESC);
CREATE INDEX idx_events_store_type_received ON events(store_id, type, received_at DESC);

-- ═══════════════════════════════════════════════
-- PROCESSED EVENTS (idempotency)
-- ═══════════════════════════════════════════════

CREATE TABLE processed_events (
  event_id VARCHAR(64) PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_processed_events_at ON processed_events(processed_at);

-- ═══════════════════════════════════════════════
-- AGENT CONFIGS
-- ═══════════════════════════════════════════════

CREATE TABLE agent_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  agent_type VARCHAR(30) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 1,
  max_actions_per_hour INTEGER NOT NULL DEFAULT 50,
  llm_model VARCHAR(50) NOT NULL DEFAULT 'gpt-4o-mini',
  max_cost_per_day_usd DECIMAL(8, 2) NOT NULL DEFAULT 5.00,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, agent_type)
);

CREATE INDEX idx_agent_configs_store ON agent_configs(store_id);

-- ═══════════════════════════════════════════════
-- AGENT RUNS
-- ═══════════════════════════════════════════════

CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  agent_type VARCHAR(30) NOT NULL,
  trigger_event_id VARCHAR(64) REFERENCES events(id),
  context JSONB NOT NULL DEFAULT '{}',
  decision JSONB,
  result JSONB,
  duration_ms INTEGER,
  llm_tokens_used INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(8, 6) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_runs_store ON agent_runs(store_id);
CREATE INDEX idx_agent_runs_store_type ON agent_runs(store_id, agent_type);
CREATE INDEX idx_agent_runs_store_created ON agent_runs(store_id, created_at DESC);
CREATE INDEX idx_agent_runs_store_type_created ON agent_runs(store_id, agent_type, created_at DESC);
CREATE INDEX idx_agent_runs_status ON agent_runs(store_id, status);
CREATE INDEX idx_agent_runs_trigger ON agent_runs(trigger_event_id);

-- ═══════════════════════════════════════════════
-- INTEGRATIONS
-- ═══════════════════════════════════════════════

CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, provider)
);

CREATE INDEX idx_integrations_store ON integrations(store_id);

-- ═══════════════════════════════════════════════
-- DAILY METRICS
-- ═══════════════════════════════════════════════

CREATE TABLE daily_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  new_customers INTEGER NOT NULL DEFAULT 0,
  returning_customers INTEGER NOT NULL DEFAULT 0,
  avg_order_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
  conversion_rate DECIMAL(5, 4) NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,
  agent_actions INTEGER NOT NULL DEFAULT 0,
  agent_cost_usd DECIMAL(8, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, date)
);

CREATE INDEX idx_daily_metrics_store_date ON daily_metrics(store_id, date DESC);

-- ═══════════════════════════════════════════════
-- UPDATED_AT TRIGGER
-- ═══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_configs_updated_at
  BEFORE UPDATE ON agent_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_metrics_updated_at
  BEFORE UPDATE ON daily_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
