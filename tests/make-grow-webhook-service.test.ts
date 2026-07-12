import { describe, expect, it, vi } from "vitest";

import { InvoiceService } from "../src/domain/invoices/invoice-service";
import { PaymentService } from "../src/domain/payments/payment-service";
import { PaymentWebhookService } from "../src/domain/payments/payment-webhook-service";
import { InMemoryCustomerRepository } from "../src/infrastructure/db/in-memory-customer-repository";
import { InMemoryInvoiceRepository } from "../src/infrastructure/db/in-memory-invoice-repository";
import { InMemoryPaymentRepository } from "../src/infrastructure/db/in-memory-payment-repository";
import { parseMakeGrowWebhookPayload } from "../src/infrastructure/grow/make-grow-webhook-parser";
import { parseMockGrowWebhookPayload } from "../src/infrastructure/grow/mock-grow-webhook-parser";
import { MockInvoiceProvider } from "../src/infrastructure/invoices/mock-invoice-provider";
import type { PaymentProvider } from "../src/domain/payments/payment-provider";

function createMakeGrowProvider(overrides?: {
  approveTransaction?: PaymentProvider["approveTransaction"];
}): PaymentProvider {
  return {
    providerKey: "make-grow",
    async createPaymentRequest(input) {
      return {
        provider: "make-grow",
        providerPaymentId: `make_process_${input.internalPaymentId}`,
        providerTransactionId: `make_tx_${input.internalPaymentId}`,
        paymentUrl: "https://grow.example/pay/mock",
        status: "payment_created",
        rawReference: {
          mode: "make-grow"
        }
      };
    },
    async getPaymentStatus(providerPaymentId) {
      return {
        provider: "make-grow",
        providerPaymentId,
        providerTransactionId: null,
        status: "payment_created"
      };
    },
    approveTransaction: overrides?.approveTransaction
  };
}

async function createServices(overrides?: {
  approveTransaction?: PaymentProvider["approveTransaction"];
}) {
  const paymentRepository = new InMemoryPaymentRepository();
  const customerRepository = new InMemoryCustomerRepository();
  const invoiceRepository = new InMemoryInvoiceRepository();
  const paymentProvider = createMakeGrowProvider(overrides);
  const paymentService = new PaymentService({
    paymentRepository,
    customerRepository,
    paymentProvider
  });
  const invoiceService = new InvoiceService({
    paymentRepository,
    invoiceRepository,
    invoiceProvider: new MockInvoiceProvider()
  });
  const paymentWebhookService = new PaymentWebhookService({
    paymentRepository,
    parseMockGrowWebhookPayload,
    parseMakeGrowWebhookPayload,
    invoiceService,
    paymentProvider
  });

  const payment = await paymentService.createPaymentRequest({
    customerName: "לקוח Make",
    customerPhone: "0501111222",
    customerEmail: "make@example.com",
    amountAgorot: 125000,
    currency: "ILS",
    description: "בדיקת Make"
  });

  return {
    paymentRepository,
    invoiceRepository,
    paymentWebhookService,
    payment: payment!
  };
}

describe("Make/GROW webhook flow", () => {
  it("maps a success payload to paid without creating a mock invoice", async () => {
    const { paymentWebhookService, payment, invoiceRepository } =
      await createServices();

    const result = await paymentWebhookService.processGrowWebhook({
      payment_id: payment.id,
      paymentLinkProcessId: payment.providerPaymentId,
      transactionId: payment.providerTransactionId,
      status: "success",
      amount: "1250.00",
      currency: "ILS",
      success: true,
      createdAt: "2026-07-12T10:00:00.000Z"
    });

    expect(result.outcome).toBe("processed");
    expect(result.payment?.status).toBe("paid");
    expect(result.message).not.toContain("קבלה הופקה");
    expect(await invoiceRepository.findByPaymentId(payment.id)).toBeNull();
  });

  it("is idempotent for a repeated notification", async () => {
    const { paymentWebhookService, payment, paymentRepository } =
      await createServices();

    const payload = {
      payment_id: payment.id,
      paymentLinkProcessId: payment.providerPaymentId,
      transactionId: payment.providerTransactionId,
      eventId: "evt_make_1",
      status: "paid",
      amount: "1250.00",
      currency: "ILS",
      success: true
    };

    const first = await paymentWebhookService.processGrowWebhook(payload);
    const second = await paymentWebhookService.processGrowWebhook(payload);
    const webhooks = await paymentRepository.listWebhooksByPaymentId(
      payment.id
    );

    expect(first.outcome).toBe("processed");
    expect(second.outcome).toBe("duplicate");
    expect(webhooks).toHaveLength(1);
  });

  it("calls approve transaction after successful processing when configured", async () => {
    const approveTransaction = vi.fn().mockResolvedValue(undefined);
    const { paymentWebhookService, payment } = await createServices({
      approveTransaction
    });

    const result = await paymentWebhookService.processGrowWebhook({
      payment_id: payment.id,
      paymentLinkProcessId: payment.providerPaymentId,
      transactionId: payment.providerTransactionId,
      eventId: "evt_make_approve",
      status: "approved",
      amount: "1250.00",
      currency: "ILS"
    });

    expect(result.outcome).toBe("processed");
    expect(approveTransaction).toHaveBeenCalledTimes(1);
  });

  it("keeps payment paid when approve transaction fails and stores a note", async () => {
    const approveTransaction = vi
      .fn()
      .mockRejectedValue(new Error("approve failed"));
    const { paymentWebhookService, payment, paymentRepository } =
      await createServices({
        approveTransaction
      });

    const result = await paymentWebhookService.processGrowWebhook({
      payment_id: payment.id,
      paymentLinkProcessId: payment.providerPaymentId,
      transactionId: payment.providerTransactionId,
      eventId: "evt_make_approve_fail",
      status: "completed",
      amount: "1250.00",
      currency: "ILS"
    });
    const storedPayment = await paymentRepository.findById(payment.id);

    expect(result.outcome).toBe("processed");
    expect(storedPayment?.status).toBe("paid");
    expect(result.webhook.processingStatus).toBe("processed");
    expect(result.webhook.processingError).toContain("Approve Transaction");
  });
});
