import type { PaymentStatus } from "./payment-status";
import type {
  CreatePaymentDraftInput,
  Payment,
  UpdatePaymentStatusInput
} from "./payment-types";
import type {
  CreatePaymentWebhookInput,
  PaymentWebhookRecord
} from "./payment-webhook-types";

export interface CreatePaymentRecordInput extends CreatePaymentDraftInput {
  id: string;
  status: Payment["status"];
  provider: string;
  providerPaymentId: string | null;
  providerTransactionId: string | null;
  paymentUrl: string | null;
  invoiceId?: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
  cancelledAt?: string | null;
  failedAt?: string | null;
}

export interface AttachProviderPaymentDetailsInput {
  paymentId: string;
  status: PaymentStatus;
  providerPaymentId: string;
  providerTransactionId: string | null;
  paymentUrl: string | null;
  updatedAt: string;
}

export interface AttachInvoiceIdInput {
  paymentId: string;
  invoiceId: string;
  updatedAt: string;
}

export type PaymentSortField =
  "created_at" | "customer_name" | "amount_agorot" | "status";

export type PaymentSortDir = "asc" | "desc";

export interface PaymentListOptions {
  limit?: number;
  offset?: number;
  status?: PaymentStatus;
  dateFrom?: string; // ISO yyyy-mm-dd, inclusive
  dateTo?: string; // ISO yyyy-mm-dd, inclusive
  customer?: string; // partial match, case-insensitive
  sortBy?: PaymentSortField;
  sortDir?: PaymentSortDir;
}

export interface PaymentListResult {
  items: Payment[];
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PaymentRepository {
  create(input: CreatePaymentRecordInput): Promise<Payment>;
  findById(id: string): Promise<Payment | null>;
  findByProviderPaymentId(providerPaymentId: string): Promise<Payment | null>;
  findByProviderTransactionId(
    providerTransactionId: string
  ): Promise<Payment | null>;
  updateStatus(input: UpdatePaymentStatusInput): Promise<Payment | null>;
  attachProviderPaymentDetails(
    input: AttachProviderPaymentDetailsInput
  ): Promise<Payment | null>;
  attachInvoiceId(input: AttachInvoiceIdInput): Promise<Payment | null>;
  list(options?: PaymentListOptions): Promise<PaymentListResult>;
  listDistinctCustomerNames(limit?: number): Promise<string[]>;
  createWebhookRecord(
    input: CreatePaymentWebhookInput
  ): Promise<PaymentWebhookRecord>;
  findWebhookByProviderEventId(
    provider: string,
    providerEventId: string
  ): Promise<PaymentWebhookRecord | null>;
  listWebhooksByPaymentId(
    paymentId: string,
    limit?: number
  ): Promise<PaymentWebhookRecord[]>;
  markWebhookProcessed(
    webhookId: string,
    processedAt: string
  ): Promise<PaymentWebhookRecord | null>;
  markWebhookFailed(
    webhookId: string,
    processingError: string,
    processedAt: string
  ): Promise<PaymentWebhookRecord | null>;
}
