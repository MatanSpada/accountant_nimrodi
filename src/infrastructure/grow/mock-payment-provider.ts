import type {
  PaymentProvider,
  ProviderPaymentRequest,
  ProviderPaymentStatusResult
} from "../../domain/payments/payment-provider";
import type { CreatePaymentDraftInput } from "../../domain/payments/payment-types";

function createDeterministicSuffix(input: {
  internalPaymentId: string;
  amountAgorot: number;
  customerName: string;
}) {
  const seed = `${input.internalPaymentId}:${input.amountAgorot}:${input.customerName}`;
  let hash = 0;

  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash.toString(36).padStart(8, "0");
}

export class MockPaymentProvider implements PaymentProvider {
  readonly providerKey = "mock-grow";

  async createPaymentRequest(
    input: CreatePaymentDraftInput & { internalPaymentId: string }
  ): Promise<ProviderPaymentRequest> {
    const suffix = createDeterministicSuffix(input);
    const providerPaymentId = `mockpay_${suffix}`;

    return {
      provider: this.providerKey,
      providerPaymentId,
      providerTransactionId: `mocktxn_${suffix}`,
      paymentUrl: `/dev/mock-grow/pay/${providerPaymentId}`,
      status: "payment_created",
      rawReference: {
        note: "Mock provider only. Real GROW request and response fields must be verified with the client's account later.",
        suffix
      }
    };
  }

  async getPaymentStatus(
    providerPaymentId: string
  ): Promise<ProviderPaymentStatusResult> {
    const lowered = providerPaymentId.toLowerCase();
    const status = lowered.includes("paid")
      ? "paid"
      : lowered.includes("fail")
        ? "failed"
        : lowered.includes("cancel")
          ? "cancelled"
          : lowered.includes("expire")
            ? "expired"
            : "pending";

    return {
      provider: this.providerKey,
      providerPaymentId,
      providerTransactionId: providerPaymentId.replace("mockpay_", "mocktxn_"),
      status
    };
  }
}
