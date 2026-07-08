import type { InvoiceStatus } from "./invoice-status";
import type { InvoiceRecord } from "./invoice-types";

export interface CreateInvoiceRecordInput {
  id: string;
  paymentId: string;
  provider: string;
  providerInvoiceId?: string | null;
  invoiceNumber?: string | null;
  invoiceUrl?: string | null;
  status: InvoiceStatus;
  rawPayload?: string | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateInvoiceRecordInput {
  invoiceId: string;
  status: InvoiceStatus;
  providerInvoiceId?: string | null;
  invoiceNumber?: string | null;
  invoiceUrl?: string | null;
  rawPayload?: string | null;
  failureReason?: string | null;
  updatedAt: string;
}

export interface InvoiceRepository {
  create(input: CreateInvoiceRecordInput): Promise<InvoiceRecord>;
  findById(invoiceId: string): Promise<InvoiceRecord | null>;
  findByPaymentId(paymentId: string): Promise<InvoiceRecord | null>;
  findByProviderInvoiceId(
    providerInvoiceId: string
  ): Promise<InvoiceRecord | null>;
  update(input: UpdateInvoiceRecordInput): Promise<InvoiceRecord | null>;
}
