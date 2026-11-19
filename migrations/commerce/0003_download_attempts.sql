-- Additive: historical counters are intentionally preserved.
-- Counts authorizations to stream, not proof of a completed browser download.
CREATE TABLE IF NOT EXISTS commerce_download_attempts (
  order_id TEXT NOT NULL REFERENCES commerce_orders(id),
  attempt_id TEXT NOT NULL,
  authorized_at INTEGER NOT NULL,
  PRIMARY KEY (order_id, attempt_id)
);
CREATE TRIGGER IF NOT EXISTS commerce_download_attempt_count
AFTER INSERT ON commerce_download_attempts
BEGIN
  UPDATE commerce_orders SET downloads=downloads+1 WHERE id=NEW.order_id;
END;
