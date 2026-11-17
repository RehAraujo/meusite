-- Complementary reconciliation prototype. Apply only to disposable local test D1.
-- Existing/historical approvals are deliberately NOT backfilled.
CREATE TABLE IF NOT EXISTS commerce_webhook_confirmations (
  order_id TEXT PRIMARY KEY,
  remote_updated INTEGER NOT NULL
);
