import type {
  PaymentProvider,
  ProviderPaymentRequest,
  ProviderPaymentStatusResult
} from "../../domain/payments/payment-provider";
import type { CreatePaymentRequestInput } from "../../domain/payments/payment-types";

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
  async createPaymentRequest(
    input: CreatePaymentRequestInput & { internalPaymentId: string }
  ): Promise<ProviderPaymentRequest> {
    const suffix = createDeterministicSuffix(input);

    return {
      provider: "mock-grow",
      providerPaymentId: `mockpay_${suffix}`,
      providerTransactionId: `mocktxn_${suffix}`,
      paymentUrl: `https://mock-payments.local/pay/${input.internalPaymentId}`,
      status: "pending",
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
          : "pending";

    return {
      provider: "mock-grow",
      providerPaymentId,
      providerTransactionId: providerPaymentId.replace("mockpay_", "mocktxn_"),
      status
    };
  }
}
