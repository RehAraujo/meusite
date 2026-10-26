-- Additive only: independent of diagnostic orders/customers/artifacts.
CREATE TABLE IF NOT EXISTS commerce_orders (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_title TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL CHECK (currency = 'BRL'),
  asset_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  mp_id TEXT UNIQUE,
  checkout_url TEXT,
  status TEXT NOT NULL DEFAULT 'creating',
  status_detail TEXT NOT NULL DEFAULT '',
  remote_updated INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  access_expires INTEGER NOT NULL,
  downloads INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS commerce_orders_expiry ON commerce_orders(access_expires);
-- Shared limits across Worker isolates. Contains only hashed IPs, expires by bucket.
CREATE TABLE IF NOT EXISTS commerce_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS commerce_limits_expiry ON commerce_limits(expires);
