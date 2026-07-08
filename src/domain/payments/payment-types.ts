import type { PaymentStatus } from "./payment-status";
import type { Currency } from "./currency";

export interface Payment {
  id: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  amountAgorot: number;
  currency: Currency;
  description: string;
  status: PaymentStatus;
  provider: string;
  providerPaymentId: string | null;
  providerTransactionId: string | null;
  paymentUrl: string | null;
  invoiceId: string | null;
  externalCrmDealId: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  failedAt: string | null;
}

export interface CreatePaymentDraftInput {
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  amountAgorot: number;
  currency: Currency;
  description: string;
  externalCrmDealId?: string | null;
}

export interface CreatePaymentRequestInput {
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  amountAgorot: number;
  currency: string;
  description: string;
  externalCrmDealId?: string | null;
}

export interface UpdatePaymentStatusInput {
  paymentId: string;
  status: PaymentStatus;
  providerTransactionId?: string | null;
  updatedAt?: string;
  paidAt?: string | null;
  cancelledAt?: string | null;
  failedAt?: string | null;
}
