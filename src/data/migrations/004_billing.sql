-- src/data/migrations/004_billing.sql

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  shopify_charge_id VARCHAR(100),
  plan VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  price_usd DECIMAL(8, 2) NOT NULL,
  trial_days INTEGER NOT NULL DEFAULT 7,
  trial_ends_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  confirmation_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_store ON subscriptions(store_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(store_id, status);
CREATE INDEX idx_subscriptions_shopify_charge ON subscriptions(shopify_charge_id);

-- Only one active subscription per store
CREATE UNIQUE INDEX idx_subscriptions_active
  ON subscriptions(store_id)
  WHERE status IN ('active', 'pending');

-- Add plan column to stores if not exists
ALTER TABLE stores ADD COLUMN IF NOT EXISTS billing_plan VARCHAR(30) DEFAULT NULL;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS billing_status VARCHAR(30) DEFAULT NULL;

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
