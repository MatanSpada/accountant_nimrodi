export const INVOICE_STATUSES = [
  "pending",
  "created",
  "failed",
  "cancelled"
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return INVOICE_STATUSES.includes(value as InvoiceStatus);
}
