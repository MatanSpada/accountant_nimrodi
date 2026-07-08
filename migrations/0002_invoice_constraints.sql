ALTER TABLE invoices ADD COLUMN failure_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_payment_id_unique
  ON invoices(payment_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_provider_invoice_unique
  ON invoices(provider, provider_invoice_id)
  WHERE provider_invoice_id IS NOT NULL;
