import type { CreatePaymentRequestInput, Payment } from "./payment-types";
import type { PaymentStatus } from "./payment-status";

export interface ProviderPaymentRequest {
  provider: string;
  providerPaymentId: string;
  providerTransactionId: string | null;
  paymentUrl: string;
  status: PaymentStatus;
  rawReference: Record<string, string | null>;
}

export interface ProviderPaymentStatusResult {
  provider: string;
  providerPaymentId: string;
  providerTransactionId: string | null;
  status: PaymentStatus;
}

export interface PaymentProvider {
  createPaymentRequest(
    input: CreatePaymentRequestInput & { internalPaymentId: string }
  ): Promise<ProviderPaymentRequest>;
  getPaymentStatus(
    providerPaymentId: string
  ): Promise<ProviderPaymentStatusResult>;
  approveTransaction?(payment: Payment): Promise<ProviderPaymentStatusResult>;
}
