-- Kept outside migrations/commerce on purpose: no wrangler migrations_dir points here,
-- so `wrangler d1 migrations apply` can never pick it up for staging or production.
-- Complementary reconciliation prototype. Apply only to disposable local test D1.
-- Existing/historical approvals are deliberately NOT backfilled.
CREATE TABLE IF NOT EXISTS commerce_webhook_confirmations (
  order_id TEXT PRIMARY KEY,
  remote_updated INTEGER NOT NULL
);
