import { describe, expect, it } from "vitest";

import { InMemoryPaymentRepository } from "../src/infrastructure/db/in-memory-payment-repository";

describe("InMemoryPaymentRepository", () => {
  it("supports the payment repository contract shape", async () => {
    const repository = new InMemoryPaymentRepository();

    const payment = await repository.create({
      id: "pay_test_001",
      customerName: "דן בדיקה",
      customerPhone: null,
      customerEmail: "dan@example.com",
      amountAgorot: 5000,
      currency: "ILS",
      description: "בדיקת repository",
      status: "pending",
      provider: "mock-grow",
      providerPaymentId: "mockpay_1",
      providerTransactionId: "mocktxn_1",
      paymentUrl: "https://mock-payments.local/pay/pay_test_001",
      invoiceId: null,
      createdAt: "2026-07-09T00:00:00.000Z",
      updatedAt: "2026-07-09T00:00:00.000Z",
      paidAt: null
    });

    expect(await repository.findById(payment.id)).toEqual(payment);
    expect(await repository.findByProviderTransactionId("mocktxn_1")).toEqual(
      payment
    );

    const updated = await repository.updateStatus({
      paymentId: payment.id,
      status: "paid",
      providerTransactionId: "mocktxn_1",
      paidAt: "2026-07-09T01:00:00.000Z"
    });

    expect(updated?.status).toBe("paid");
    expect((await repository.list()).length).toBe(1);
  });
});
