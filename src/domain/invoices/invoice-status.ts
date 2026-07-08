export const INVOICE_STATUSES = [
  "draft",
  "issued",
  "failed",
  "cancelled"
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return INVOICE_STATUSES.includes(value as InvoiceStatus);
}
