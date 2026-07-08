import { describe, expect, it } from "vitest";

import { AppError } from "../src/shared/errors/app-error";
import { InMemoryPaymentRepository } from "../src/infrastructure/db/in-memory-payment-repository";

describe("InMemoryPaymentRepository", () => {
  it("creates, finds, updates and paginates payments", async () => {
    const repository = new InMemoryPaymentRepository();

    const created = await repository.create({
      id: "pay_test_001",
      customerId: "cus_001",
      customerName: "דן בדיקה",
      customerPhone: null,
      customerEmail: "dan@example.com",
      amountAgorot: 5000,
      currency: "ILS",
      description: "בדיקת repository",
      status: "draft",
      provider: "mock-grow",
      providerPaymentId: null,
      providerTransactionId: null,
      paymentUrl: null,
      invoiceId: null,
      externalCrmDealId: "deal_001",
      createdAt: "2026-07-09T00:00:00.000Z",
      updatedAt: "2026-07-09T00:00:00.000Z",
      paidAt: null,
      cancelledAt: null,
      failedAt: null
    });

    const withProvider = await repository.attachProviderPaymentDetails({
      paymentId: created.id,
      status: "payment_created",
      providerPaymentId: "mockpay_1",
      providerTransactionId: "mocktxn_1",
      paymentUrl: "https://mock-payments.local/pay/pay_test_001",
      updatedAt: "2026-07-09T00:05:00.000Z"
    });

    expect(withProvider?.status).toBe("payment_created");
    expect(await repository.findById(created.id)).toEqual(withProvider);
    expect(await repository.findByProviderTransactionId("mocktxn_1")).toEqual(
      withProvider
    );

    const updated = await repository.updateStatus({
      paymentId: created.id,
      status: "paid",
      providerTransactionId: "mocktxn_1",
      paidAt: "2026-07-09T01:00:00.000Z",
      updatedAt: "2026-07-09T01:00:00.000Z"
    });

    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).toBe("2026-07-09T01:00:00.000Z");

    const list = await repository.list({ limit: 10, offset: 0 });
    expect(list.items.length).toBe(1);
    expect(list.hasMore).toBe(false);
  });

  it("rejects duplicate provider transaction ids", async () => {
    const repository = new InMemoryPaymentRepository();

    await repository.create({
      id: "pay_a",
      customerName: "א",
      customerPhone: null,
      customerEmail: null,
      amountAgorot: 1000,
      currency: "ILS",
      description: "א",
      status: "payment_created",
      provider: "mock-grow",
      providerPaymentId: "mockpay_a",
      providerTransactionId: "mocktxn_shared",
      paymentUrl: null,
      invoiceId: null,
      externalCrmDealId: null,
      createdAt: "2026-07-09T00:00:00.000Z",
      updatedAt: "2026-07-09T00:00:00.000Z",
      paidAt: null,
      cancelledAt: null,
      failedAt: null
    });

    await repository.create({
      id: "pay_b",
      customerName: "ב",
      customerPhone: null,
      customerEmail: null,
      amountAgorot: 2000,
      currency: "ILS",
      description: "ב",
      status: "draft",
      provider: "mock-grow",
      providerPaymentId: null,
      providerTransactionId: null,
      paymentUrl: null,
      invoiceId: null,
      externalCrmDealId: null,
      createdAt: "2026-07-09T00:01:00.000Z",
      updatedAt: "2026-07-09T00:01:00.000Z",
      paidAt: null,
      cancelledAt: null,
      failedAt: null
    });

    await expect(
      repository.attachProviderPaymentDetails({
        paymentId: "pay_b",
        status: "payment_created",
        providerPaymentId: "mockpay_b",
        providerTransactionId: "mocktxn_shared",
        paymentUrl: null,
        updatedAt: "2026-07-09T00:02:00.000Z"
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it("stores webhook payloads and marks processing results", async () => {
    const repository = new InMemoryPaymentRepository();

    const webhook = await repository.createWebhookRecord({
      id: "wh_001",
      paymentId: null,
      provider: "mock-grow",
      providerEventId: "evt_001",
      providerTransactionId: "mocktxn_1",
      eventType: "payment.updated",
      rawPayload: JSON.stringify({ ok: true }),
      receivedAt: "2026-07-09T00:00:00.000Z"
    });

    expect(webhook.rawPayload).toBe('{"ok":true}');
    expect(webhook.processingStatus).toBe("received");

    const processed = await repository.markWebhookProcessed(
      webhook.id,
      "2026-07-09T00:05:00.000Z"
    );
    expect(processed?.processingStatus).toBe("processed");

    const failed = await repository.markWebhookFailed(
      webhook.id,
      "downstream error",
      "2026-07-09T00:06:00.000Z"
    );
    expect(failed?.processingStatus).toBe("failed");
    expect(failed?.processingError).toBe("downstream error");
  });
});
