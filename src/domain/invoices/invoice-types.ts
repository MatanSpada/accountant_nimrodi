import type { InvoiceStatus } from "./invoice-status";

export interface InvoiceRecord {
  id: string;
  paymentId: string;
  provider: string;
  providerInvoiceId: string | null;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  status: InvoiceStatus;
  rawPayload: string | null;
  createdAt: string;
  updatedAt: string;
}
