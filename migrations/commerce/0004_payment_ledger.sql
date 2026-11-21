-- R1a: payment ledger (spec V3). Additive only: creates tables and indexes and adopts
-- existing Checkout Pro orders. Never alters or deletes commerce_orders rows, so the
-- versions already in production keep working on top of this schema.
-- Authorized for the STAGING D1 only (R1a homologation, 20/11/2026). Production has
-- approved only 0001-0003: scripts/commerce-release-plan.mjs refuses a production plan
-- while this file is unapproved, and tests/commerce-config.test.js pins both lists.

-- Every charge (Checkout Pro, Pix, card) is an attempt. At most one attempt per order
-- may hold the charge lock (partial unique index), shared by all flows.
CREATE TABLE IF NOT EXISTS commerce_payment_attempts (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id),
  flow TEXT NOT NULL CHECK (flow IN ('checkout_pro', 'pix', 'card')),
  phase TEXT NOT NULL CHECK (phase IN ('reserved', 'sending', 'open', 'canceling', 'uncertain', 'closed_unpaid', 'settled', 'review')),
  holds_lock INTEGER NOT NULL CHECK (holds_lock IN (0, 1)),
  mp_id TEXT UNIQUE,
  request_body TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  send_count INTEGER NOT NULL DEFAULT 0,
  first_sent_at INTEGER,
  last_sent_at INTEGER,
  mp_status TEXT,
  mp_status_detail TEXT,
  remote_updated INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  pix_qr_code TEXT,
  pix_qr_base64 TEXT,
  pix_expires_at INTEGER,
  exposure_until INTEGER,
  watch_until INTEGER NOT NULL,
  next_check_at INTEGER,
  check_failures INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS commerce_attempts_lock ON commerce_payment_attempts(order_id) WHERE holds_lock = 1;
CREATE INDEX IF NOT EXISTS commerce_attempts_due ON commerce_payment_attempts(next_check_at) WHERE next_check_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS commerce_attempts_order ON commerce_payment_attempts(order_id);

-- Financial facts, one row per provider payment. settled only goes 0 -> 1 and
-- refunded_cents only grows; dispute_stage changes only with a newer snapshot.
CREATE TABLE IF NOT EXISTS commerce_settlements (
  provider_payment_id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES commerce_payment_attempts(id),
  order_id TEXT NOT NULL REFERENCES commerce_orders(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  settled INTEGER NOT NULL DEFAULT 0 CHECK (settled IN (0, 1)),
  settled_at INTEGER,
  refunded_cents INTEGER NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0),
  dispute_stage TEXT NOT NULL DEFAULT 'none' CHECK (dispute_stage IN ('none', 'open', 'lost', 'reversed')),
  dispute_updated INTEGER NOT NULL DEFAULT 0,
  remote_updated INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS commerce_settlements_order ON commerce_settlements(order_id);

-- Access right computed from settlements, risk holds and manual decisions.
-- R1a: shadow only. Delivery still uses the current rule. No expiry is defined here:
-- access validity stays with the existing delivery rule until a commercial decision.
CREATE TABLE IF NOT EXISTS commerce_entitlements (
  order_id TEXT PRIMARY KEY REFERENCES commerce_orders(id),
  product_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('none', 'active', 'suspended', 'revoked')),
  reason TEXT NOT NULL,
  granted_at INTEGER,
  eligible_count INTEGER NOT NULL DEFAULT 0,
  computed_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS commerce_entitlement_overrides (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id),
  action TEXT NOT NULL CHECK (action IN ('grant', 'revoke')),
  reason TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  cleared_at INTEGER
);
CREATE INDEX IF NOT EXISTS commerce_overrides_order ON commerce_entitlement_overrides(order_id, created_at);

-- Human review queue. Never blocks delivery to a buyer who paid.
CREATE TABLE IF NOT EXISTS commerce_payment_reviews (
  subject_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('duplicate_settlement', 'settled_after_cancel', 'amount_mismatch', 'identity_mismatch', 'creation_uncertain', 'unknown_remote_state', 'reconciler_stalled', 'partial_refund')),
  order_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolution TEXT CHECK (resolution IS NULL OR resolution IN ('refunded', 'kept', 'false_alarm')),
  PRIMARY KEY (subject_id, reason)
);
CREATE INDEX IF NOT EXISTS commerce_reviews_open ON commerce_payment_reviews(resolved_at);

-- Buyer e-mail (approved decision): encrypted, plus a keyed hash for access recovery.
-- Unused in R1a; created now so the schema matches the spec.
CREATE TABLE IF NOT EXISTS commerce_order_contacts (
  order_id TEXT PRIMARY KEY REFERENCES commerce_orders(id),
  email_ciphertext TEXT NOT NULL,
  email_lookup TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  purge_after INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS commerce_contacts_lookup ON commerce_order_contacts(email_lookup);
CREATE INDEX IF NOT EXISTS commerce_contacts_purge ON commerce_order_contacts(purge_after);

CREATE TABLE IF NOT EXISTS commerce_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO commerce_settings (key, value, updated_at) VALUES ('pix_creation', 'off', 0);

CREATE TABLE IF NOT EXISTS commerce_job_runs (
  run_id TEXT PRIMARY KEY,
  job TEXT NOT NULL,
  runner TEXT NOT NULL CHECK (runner IN ('cron', 'storefront')),
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  claimed INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  overdue_at_start INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS commerce_job_runs_recent ON commerce_job_runs(job, finished_at);

CREATE TABLE IF NOT EXISTS commerce_job_leases (
  job TEXT PRIMARY KEY,
  holder TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Adopt existing Checkout Pro orders as attempts 'legacy:<order id>'. The phase is a
-- starting point only; the first authoritative snapshot corrects it. Settlements are
-- NOT invented here: they are recorded only from provider snapshots.
INSERT OR IGNORE INTO commerce_payment_attempts (
  id, order_id, flow, phase, holds_lock, mp_id, request_body, request_hash,
  mp_status, mp_status_detail, remote_updated, amount_cents, watch_until,
  created_at, updated_at
)
SELECT
  'legacy:' || o.id, o.id, 'checkout_pro',
  CASE
    WHEN o.status = 'processed' AND o.status_detail = 'accredited' THEN 'open'
    WHEN o.status IN ('canceled', 'expired', 'failed') THEN 'closed_unpaid'
    ELSE 'open'
  END,
  CASE WHEN o.status IN ('canceled', 'expired', 'failed') THEN 0 ELSE 1 END,
  o.mp_id, '{}', 'legacy', o.status, o.status_detail, 0, o.amount_cents,
  o.created_at + 172800000, o.created_at, o.created_at
FROM commerce_orders o
WHERE o.mp_id IS NOT NULL;
