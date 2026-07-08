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
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceInput {
  paymentId: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  amountAgorot: number;
  currency: string;
  description: string;
  providerPaymentId: string | null;
  providerTransactionId: string | null;
}
