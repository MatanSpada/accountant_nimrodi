import { describe, expect, it } from "vitest";

import { MockPaymentProvider } from "../src/infrastructure/grow/mock-payment-provider";

describe("MockPaymentProvider", () => {
  it("creates a deterministic fake payment request", async () => {
    const provider = new MockPaymentProvider();

    const result = await provider.createPaymentRequest({
      internalPaymentId: "pay_test_123",
      customerName: "לקוח לבדיקה",
      customerPhone: "0500000000",
      customerEmail: "test@example.com",
      amountAgorot: 125000,
      currency: "ILS",
      description: "בדיקת mock"
    });

    expect(result.provider).toBe("mock-grow");
    expect(result.status).toBe("payment_created");
    expect(result.providerPaymentId).toBe("mockpay_00pqlohn");
    expect(result.providerTransactionId).toBe("mocktxn_00pqlohn");
    expect(result.paymentUrl).toBe(
      "https://mock-payments.local/pay/pay_test_123"
    );
  });
});
