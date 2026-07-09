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
    expect(await repository.findByProviderPaymentId("mockpay_1")).toEqual(
      withProvider
    );
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

  describe("filtering and sorting", () => {
    async function buildRepo() {
      const repository = new InMemoryPaymentRepository();
      const base = {
        customerPhone: null,
        customerEmail: null,
        currency: "ILS" as const,
        provider: "mock-grow",
        providerPaymentId: null,
        providerTransactionId: null,
        paymentUrl: null,
        invoiceId: null,
        externalCrmDealId: null,
        paidAt: null,
        cancelledAt: null,
        failedAt: null
      };
      await repository.create({
        ...base,
        id: "pay_1",
        customerName: "ישראל ישראלי",
        amountAgorot: 10000,
        description: "חשבון א",
        status: "paid",
        createdAt: "2026-07-01T10:00:00.000Z",
        updatedAt: "2026-07-01T10:00:00.000Z"
      });
      await repository.create({
        ...base,
        id: "pay_2",
        customerName: "שרה כהן",
        amountAgorot: 5000,
        description: "חשבון ב",
        status: "pending",
        createdAt: "2026-07-10T08:00:00.000Z",
        updatedAt: "2026-07-10T08:00:00.000Z"
      });
      await repository.create({
        ...base,
        id: "pay_3",
        customerName: "ישראל לוי",
        amountAgorot: 20000,
        description: "חשבון ג",
        status: "paid",
        createdAt: "2026-07-15T12:00:00.000Z",
        updatedAt: "2026-07-15T12:00:00.000Z"
      });
      return repository;
    }

    it("filters by status=paid", async () => {
      const repo = await buildRepo();
      const result = await repo.list({ status: "paid" });
      expect(result.items).toHaveLength(2);
      expect(result.items.every((p) => p.status === "paid")).toBe(true);
    });

    it("filters by dateFrom (inclusive)", async () => {
      const repo = await buildRepo();
      const result = await repo.list({ dateFrom: "2026-07-10" });
      expect(result.items.map((p) => p.id).sort()).toEqual(["pay_2", "pay_3"]);
    });

    it("filters by dateTo (inclusive)", async () => {
      const repo = await buildRepo();
      const result = await repo.list({ dateTo: "2026-07-10" });
      expect(result.items.map((p) => p.id).sort()).toEqual(["pay_1", "pay_2"]);
    });

    it("filters by date range", async () => {
      const repo = await buildRepo();
      const result = await repo.list({
        dateFrom: "2026-07-10",
        dateTo: "2026-07-10"
      });
      expect(result.items.map((p) => p.id)).toEqual(["pay_2"]);
    });

    it("filters by partial customer name (case-insensitive)", async () => {
      const repo = await buildRepo();
      const result = await repo.list({ customer: "ישראל" });
      expect(result.items.map((p) => p.id).sort()).toEqual(["pay_1", "pay_3"]);
    });

    it("combines status and customer filters", async () => {
      const repo = await buildRepo();
      const result = await repo.list({ status: "paid", customer: "לוי" });
      expect(result.items.map((p) => p.id)).toEqual(["pay_3"]);
    });

    it("sorts by amount_agorot ascending", async () => {
      const repo = await buildRepo();
      const result = await repo.list({
        sortBy: "amount_agorot",
        sortDir: "asc"
      });
      expect(result.items.map((p) => p.amountAgorot)).toEqual([
        5000, 10000, 20000
      ]);
    });

    it("sorts by amount_agorot descending", async () => {
      const repo = await buildRepo();
      const result = await repo.list({
        sortBy: "amount_agorot",
        sortDir: "desc"
      });
      expect(result.items.map((p) => p.amountAgorot)).toEqual([
        20000, 10000, 5000
      ]);
    });

    it("sorts by created_at ascending", async () => {
      const repo = await buildRepo();
      const result = await repo.list({
        sortBy: "created_at",
        sortDir: "asc"
      });
      expect(result.items.map((p) => p.id)).toEqual([
        "pay_1",
        "pay_2",
        "pay_3"
      ]);
    });

    it("defaults to created_at desc", async () => {
      const repo = await buildRepo();
      const result = await repo.list({});
      expect(result.items.map((p) => p.id)).toEqual([
        "pay_3",
        "pay_2",
        "pay_1"
      ]);
    });

    it("listDistinctCustomerNames returns sorted unique names", async () => {
      const repo = await buildRepo();
      const names = await repo.listDistinctCustomerNames();
      expect(names).toContain("ישראל ישראלי");
      expect(names).toContain("ישראל לוי");
      expect(names).toContain("שרה כהן");
      expect(names.length).toBe(3);
    });

    it("listDistinctCustomerNames respects limit", async () => {
      const repo = await buildRepo();
      const names = await repo.listDistinctCustomerNames(2);
      expect(names.length).toBe(2);
    });
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
    expect(
      await repository.findWebhookByProviderEventId("mock-grow", "evt_001")
    ).toEqual(webhook);
    expect(await repository.listWebhooksByPaymentId("missing")).toEqual([]);

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
