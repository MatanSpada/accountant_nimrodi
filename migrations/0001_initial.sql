CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  external_crm_customer_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_external_crm_customer_id
  ON customers(external_crm_customer_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
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
  external_crm_deal_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT,
  cancelled_at TEXT,
  failed_at TEXT,
  FOREIGN KEY(customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_provider_transaction_id
  ON payments(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_external_crm_deal_id
  ON payments(external_crm_deal_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_transaction_unique
  ON payments(provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_webhooks (
  id TEXT PRIMARY KEY,
  payment_id TEXT,
  provider TEXT NOT NULL,
  provider_event_id TEXT,
  provider_transaction_id TEXT,
  event_type TEXT NOT NULL,
  raw_payload TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  processing_status TEXT NOT NULL,
  processing_error TEXT,
  FOREIGN KEY(payment_id) REFERENCES payments(id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhooks_payment_id
  ON payment_webhooks(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_provider_transaction_id
  ON payment_webhooks(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_received_at
  ON payment_webhooks(received_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_webhooks_provider_event_unique
  ON payment_webhooks(provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_invoice_id TEXT,
  invoice_number TEXT,
  invoice_url TEXT,
  status TEXT NOT NULL,
  raw_payload TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(payment_id) REFERENCES payments(id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_payment_id ON invoices(payment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_provider_invoice_id
  ON invoices(provider_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
