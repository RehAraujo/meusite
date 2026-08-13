CREATE TABLE IF NOT EXISTS customers (customer_id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, whatsapp TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders (order_id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(customer_id), product_type TEXT NOT NULL, selected_channels TEXT NOT NULL, instagram_handle TEXT, site_url TEXT, primary_goal TEXT NOT NULL, desired_perceptions TEXT NOT NULL, status TEXT NOT NULL, payment_status TEXT NOT NULL, payment_provider TEXT, payment_reference TEXT, access_token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, updated_at);
CREATE TABLE IF NOT EXISTS artifacts (artifact_id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(order_id), type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_artifacts_order_type ON artifacts(order_id, type, created_at);
CREATE TABLE IF NOT EXISTS audit_events (event_id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(order_id), occurred_at TEXT NOT NULL, actor_type TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, reason TEXT NOT NULL, change_json TEXT, previous_event_hash TEXT, event_hash TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_audit_order ON audit_events(order_id, occurred_at);

