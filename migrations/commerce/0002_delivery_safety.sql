-- Dedicated commerce database only. Never apply against production diagnostics.
CREATE TABLE IF NOT EXISTS commerce_resources (
  resource_id TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id),
  PRIMARY KEY (resource_id, order_id)
);
CREATE INDEX IF NOT EXISTS commerce_resources_order ON commerce_resources(order_id);
CREATE TABLE IF NOT EXISTS commerce_risk_events (
  topic TEXT NOT NULL CHECK (topic IN ('fraud', 'chargeback')),
  resource_id TEXT NOT NULL,
  task TEXT NOT NULL CHECK (task IN ('refund_review', 'dispute_review')),
  received_at INTEGER NOT NULL,
  PRIMARY KEY (topic, resource_id)
);
-- Durable holds cannot be undone by stale/approved order updates or coverage_applied.
CREATE TABLE IF NOT EXISTS commerce_delivery_holds (
  order_id TEXT PRIMARY KEY REFERENCES commerce_orders(id),
  reason TEXT NOT NULL CHECK (reason IN ('refund', 'chargeback', 'fraud')),
  created_at INTEGER NOT NULL
);
