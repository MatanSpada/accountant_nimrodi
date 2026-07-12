import type { CreatePaymentDraftInput, Payment } from "./payment-types";
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

export interface ProviderTransactionApprovalInput {
  payment: Payment;
  eventType: string;
  providerEventId: string | null;
  rawPayload: unknown;
}

export interface PaymentProvider {
  readonly providerKey: string;
  assertReady?(): void;
  createPaymentRequest(
    input: CreatePaymentDraftInput & { internalPaymentId: string }
  ): Promise<ProviderPaymentRequest>;
  getPaymentStatus(
    providerPaymentId: string
  ): Promise<ProviderPaymentStatusResult>;
  approveTransaction?(input: ProviderTransactionApprovalInput): Promise<void>;
}
