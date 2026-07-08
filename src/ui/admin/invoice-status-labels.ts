import type { InvoiceStatus } from "../../domain/invoices/invoice-status";

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending: "ממתין",
  created: "נוצרה",
  failed: "נכשלה",
  cancelled: "בוטלה"
};

export function getInvoiceStatusLabel(status: InvoiceStatus) {
  return INVOICE_STATUS_LABELS[status];
}
