CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  amount_agorot INTEGER NOT NULL CHECK (amount_agorot > 0),
  currency TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_payment_id TEXT,
  provider_transaction_id TEXT,
  payment_url TEXT,
  invoice_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_transaction_id ON payments(provider_transaction_id);

CREATE TABLE IF NOT EXISTS payment_webhooks (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  received_at TEXT NOT NULL,
  payment_id TEXT,
  FOREIGN KEY(payment_id) REFERENCES payments(id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_invoice_id TEXT,
  receipt_number TEXT,
  receipt_url TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(payment_id) REFERENCES payments(id)
);
