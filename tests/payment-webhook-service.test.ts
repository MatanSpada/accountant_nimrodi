import { describe, expect, it } from "vitest";

import { PaymentService } from "../src/domain/payments/payment-service";
import { PaymentWebhookService } from "../src/domain/payments/payment-webhook-service";
import { InvoiceService } from "../src/domain/invoices/invoice-service";
import { InMemoryPaymentRepository } from "../src/infrastructure/db/in-memory-payment-repository";
import { InMemoryCustomerRepository } from "../src/infrastructure/db/in-memory-customer-repository";
import { MockPaymentProvider } from "../src/infrastructure/grow/mock-payment-provider";
import { parseMockGrowWebhookPayload } from "../src/infrastructure/grow/mock-grow-webhook-parser";
import { InMemoryInvoiceRepository } from "../src/infrastructure/db/in-memory-invoice-repository";
import { MockInvoiceProvider } from "../src/infrastructure/invoices/mock-invoice-provider";

async function createServices() {
  const paymentRepository = new InMemoryPaymentRepository();
  const customerRepository = new InMemoryCustomerRepository();
  const invoiceRepository = new InMemoryInvoiceRepository();
  const paymentService = new PaymentService({
    paymentRepository,
    customerRepository,
    paymentProvider: new MockPaymentProvider()
  });
  const invoiceService = new InvoiceService({
    paymentRepository,
    invoiceRepository,
    invoiceProvider: new MockInvoiceProvider()
  });
  const paymentWebhookService = new PaymentWebhookService({
    paymentRepository,
    parseMockGrowWebhookPayload,
    invoiceService
  });
  const payment = await paymentService.createPaymentRequest({
    customerName: "לקוח webhook",
    customerPhone: "0501234567",
    customerEmail: "webhook@example.com",
    amountAgorot: 125000,
    currency: "ILS",
    description: "בדיקת webhook"
  });

  return {
    paymentRepository,
    invoiceRepository,
    invoiceService,
    paymentWebhookService,
    payment: payment!
  };
}

function createWebhookPayload(input: {
  eventId: string;
  status: "paid" | "failed" | "cancelled" | "expired";
  providerPaymentId: string;
  providerTransactionId: string;
  amountAgorot?: number;
  currency?: string;
}) {
  return {
    event_id: input.eventId,
    event_type: `payment.${input.status}`,
    provider: "mock_grow",
    provider_payment_id: input.providerPaymentId,
    provider_transaction_id: input.providerTransactionId,
    status: input.status,
    amount_agorot: input.amountAgorot ?? 125000,
    currency: input.currency ?? "ILS",
    occurred_at: "2026-07-09T10:00:00.000Z"
  };
}

describe("PaymentWebhookService", () => {
  it("updates a payment_created payment to paid", async () => {
    const { paymentWebhookService, payment, invoiceRepository } =
      await createServices();

    const result = await paymentWebhookService.processMockGrowWebhook(
      createWebhookPayload({
        eventId: "evt_paid_1",
        status: "paid",
        providerPaymentId: payment.providerPaymentId!,
        providerTransactionId: payment.providerTransactionId!
      })
    );

    expect(result.outcome).toBe("processed");
    expect(result.payment?.status).toBe("paid");
    expect(result.payment?.paidAt).toBe("2026-07-09T10:00:00.000Z");
    expect(result.invoiceAttempt?.outcome).toBe("created");
    expect(await invoiceRepository.findByPaymentId(payment.id)).not.toBeNull();
  });

  it("updates a pending payment to paid", async () => {
    const { paymentRepository, paymentWebhookService, payment } =
      await createServices();

    await paymentRepository.updateStatus({
      paymentId: payment.id,
      status: "pending",
      updatedAt: "2026-07-09T09:00:00.000Z"
    });

    const result = await paymentWebhookService.processMockGrowWebhook(
      createWebhookPayload({
        eventId: "evt_paid_pending",
        status: "paid",
        providerPaymentId: payment.providerPaymentId!,
        providerTransactionId: payment.providerTransactionId!
      })
    );

    expect(result.outcome).toBe("processed");
    expect(result.payment?.status).toBe("paid");
  });

  it.each([
    ["failed", "failedAt"],
    ["cancelled", "cancelledAt"],
    ["expired", "updatedAt"]
  ] as const)(
    "updates payment status to %s",
    async (status, timestampField) => {
      const { paymentWebhookService, payment } = await createServices();

      const result = await paymentWebhookService.processMockGrowWebhook(
        createWebhookPayload({
          eventId: `evt_${status}_1`,
          status,
          providerPaymentId: payment.providerPaymentId!,
          providerTransactionId: payment.providerTransactionId!
        })
      );

      expect(result.outcome).toBe("processed");
      expect(result.payment?.status).toBe(status);
      expect(result.payment?.[timestampField]).toBeDefined();
    }
  );

  it("stores failed webhook on amount mismatch and does not update payment", async () => {
    const { paymentRepository, paymentWebhookService, payment } =
      await createServices();

    const result = await paymentWebhookService.processMockGrowWebhook(
      createWebhookPayload({
        eventId: "evt_bad_amount",
        status: "paid",
        providerPaymentId: payment.providerPaymentId!,
        providerTransactionId: payment.providerTransactionId!,
        amountAgorot: 1
      })
    );

    const storedPayment = await paymentRepository.findById(payment.id);

    expect(result.outcome).toBe("failed");
    expect(result.webhook.processingStatus).toBe("failed");
    expect(result.webhook.rawPayload).toContain('"amount_agorot":1');
    expect(storedPayment?.status).toBe("payment_created");
  });

  it("stores failed webhook on currency mismatch and does not update payment", async () => {
    const { paymentRepository, paymentWebhookService, payment } =
      await createServices();

    const result = await paymentWebhookService.processMockGrowWebhook(
      createWebhookPayload({
        eventId: "evt_bad_currency",
        status: "paid",
        providerPaymentId: payment.providerPaymentId!,
        providerTransactionId: payment.providerTransactionId!,
        currency: "USD"
      })
    );

    const storedPayment = await paymentRepository.findById(payment.id);

    expect(result.outcome).toBe("failed");
    expect(result.message).toContain("מטבע");
    expect(storedPayment?.status).toBe("payment_created");
  });

  it("stores failed webhook when provider identifiers are unknown", async () => {
    const { paymentWebhookService } = await createServices();

    const result = await paymentWebhookService.processMockGrowWebhook(
      createWebhookPayload({
        eventId: "evt_unknown_payment",
        status: "paid",
        providerPaymentId: "mockpay_missing",
        providerTransactionId: "mocktxn_missing"
      })
    );

    expect(result.outcome).toBe("failed");
    expect(result.payment).toBeNull();
    expect(result.webhook.processingStatus).toBe("failed");
  });

  it("does not process a duplicate event id twice", async () => {
    const {
      paymentRepository,
      paymentWebhookService,
      payment,
      invoiceRepository
    } = await createServices();
    const payload = createWebhookPayload({
      eventId: "evt_duplicate",
      status: "paid",
      providerPaymentId: payment.providerPaymentId!,
      providerTransactionId: payment.providerTransactionId!
    });

    const first = await paymentWebhookService.processMockGrowWebhook(payload);
    const second = await paymentWebhookService.processMockGrowWebhook(payload);
    const webhooks = await paymentRepository.listWebhooksByPaymentId(
      payment.id
    );

    expect(first.outcome).toBe("processed");
    expect(second.outcome).toBe("duplicate");
    expect(webhooks).toHaveLength(1);
    expect(await invoiceRepository.findByPaymentId(payment.id)).not.toBeNull();
  });

  it("rejects invalid final-status transitions safely", async () => {
    const { paymentRepository, paymentWebhookService, payment } =
      await createServices();

    await paymentWebhookService.processMockGrowWebhook(
      createWebhookPayload({
        eventId: "evt_paid_once",
        status: "paid",
        providerPaymentId: payment.providerPaymentId!,
        providerTransactionId: payment.providerTransactionId!
      })
    );

    const result = await paymentWebhookService.processMockGrowWebhook(
      createWebhookPayload({
        eventId: "evt_failed_after_paid",
        status: "failed",
        providerPaymentId: payment.providerPaymentId!,
        providerTransactionId: payment.providerTransactionId!
      })
    );

    const storedPayment = await paymentRepository.findById(payment.id);

    expect(result.outcome).toBe("failed");
    expect(result.message).toContain("לא ניתן לעבור");
    expect(storedPayment?.status).toBe("paid");
  });

  it("stores raw payload and lists webhook records for the payment", async () => {
    const { paymentWebhookService, payment } = await createServices();

    const result = await paymentWebhookService.processMockGrowWebhook(
      createWebhookPayload({
        eventId: "evt_raw_payload",
        status: "paid",
        providerPaymentId: payment.providerPaymentId!,
        providerTransactionId: payment.providerTransactionId!
      })
    );

    const webhooks = await paymentWebhookService.listPaymentWebhooks(
      payment.id
    );

    expect(result.webhook.rawPayload).toContain('"event_id":"evt_raw_payload"');
    expect(webhooks).toHaveLength(1);
    expect(webhooks[0]?.eventType).toBe("payment.paid");
  });

  it("does not create invoice for failed cancelled or expired statuses", async () => {
    for (const status of ["failed", "cancelled", "expired"] as const) {
      const { paymentWebhookService, payment, invoiceRepository } =
        await createServices();

      const result = await paymentWebhookService.processMockGrowWebhook(
        createWebhookPayload({
          eventId: `evt_no_invoice_${status}`,
          status,
          providerPaymentId: payment.providerPaymentId!,
          providerTransactionId: payment.providerTransactionId!
        })
      );

      expect(result.outcome).toBe("processed");
      expect(await invoiceRepository.findByPaymentId(payment.id)).toBeNull();
    }
  });
});
