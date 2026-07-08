import type { PaymentStatus } from "./payment-status";

export interface Payment {
  id: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  amountAgorot: number;
  currency: string;
  description: string;
  status: PaymentStatus;
  provider: string;
  providerPaymentId: string | null;
  providerTransactionId: string | null;
  paymentUrl: string | null;
  invoiceId: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
}

export interface CreatePaymentRequestInput {
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  amountAgorot: number;
  currency: string;
  description: string;
}

export interface UpdatePaymentStatusInput {
  paymentId: string;
  status: PaymentStatus;
  providerTransactionId?: string | null;
  paidAt?: string | null;
}
