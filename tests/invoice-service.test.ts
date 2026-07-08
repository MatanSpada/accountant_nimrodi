import { describe, expect, it } from "vitest";

import { InvoiceService } from "../src/domain/invoices/invoice-service";
import { InMemoryInvoiceRepository } from "../src/infrastructure/db/in-memory-invoice-repository";
import { InMemoryPaymentRepository } from "../src/infrastructure/db/in-memory-payment-repository";
import { MockInvoiceProvider } from "../src/infrastructure/invoices/mock-invoice-provider";

async function createPaidPayment(
  paymentRepository: InMemoryPaymentRepository,
  input?: {
    id?: string;
    description?: string;
    status?: "paid" | "payment_created";
  }
) {
  const created = await paymentRepository.create({
    id: input?.id ?? "pay_invoice_test",
    customerId: null,
    customerName: "לקוח קבלה",
    customerPhone: "0501234567",
    customerEmail: "invoice@example.com",
    amountAgorot: 125000,
    currency: "ILS",
    description: input?.description ?? "בדיקת קבלה",
    status: input?.status ?? "paid",
    provider: "mock-grow",
    providerPaymentId: "mockpay_invoice_test",
    providerTransactionId: "mocktxn_invoice_test",
    paymentUrl: "/dev/mock-grow/pay/mockpay_invoice_test",
    invoiceId: null,
    externalCrmDealId: null,
    createdAt: "2026-07-09T09:00:00.000Z",
    updatedAt: "2026-07-09T09:00:00.000Z",
    paidAt: input?.status === "paid" ? "2026-07-09T09:00:00.000Z" : null,
    cancelledAt: null,
    failedAt: null
  });

  return created;
}

describe("InvoiceService", () => {
  it("creates an invoice for a paid payment and attaches invoice id", async () => {
    const paymentRepository = new InMemoryPaymentRepository();
    const invoiceRepository = new InMemoryInvoiceRepository();
    const payment = await createPaidPayment(paymentRepository);
    const service = new InvoiceService({
      paymentRepository,
      invoiceRepository,
      invoiceProvider: new MockInvoiceProvider()
    });

    const result = await service.ensureInvoiceForPaidPayment(payment.id);
    const storedPayment = await paymentRepository.findById(payment.id);

    expect(result.outcome).toBe("created");
    expect(result.invoice.status).toBe("created");
    expect(result.invoice.providerInvoiceId).toBe(`mock_inv_${payment.id}`);
    expect(result.invoice.rawPayload).toContain('"providerInvoiceId"');
    expect(storedPayment?.invoiceId).toBe(result.invoice.id);
  });

  it("refuses invoice creation for non-paid payment", async () => {
    const paymentRepository = new InMemoryPaymentRepository();
    const invoiceRepository = new InMemoryInvoiceRepository();
    const payment = await createPaidPayment(paymentRepository, {
      id: "pay_not_paid",
      status: "payment_created"
    });
    const service = new InvoiceService({
      paymentRepository,
      invoiceRepository,
      invoiceProvider: new MockInvoiceProvider()
    });

    await expect(
      service.ensureInvoiceForPaidPayment(payment.id)
    ).rejects.toThrow("ניתן ליצור קבלה רק עבור תשלום ששולם.");
  });

  it("does not create a duplicate invoice for the same payment", async () => {
    const paymentRepository = new InMemoryPaymentRepository();
    const invoiceRepository = new InMemoryInvoiceRepository();
    const payment = await createPaidPayment(paymentRepository, {
      id: "pay_existing_invoice"
    });
    const service = new InvoiceService({
      paymentRepository,
      invoiceRepository,
      invoiceProvider: new MockInvoiceProvider()
    });

    const first = await service.ensureInvoiceForPaidPayment(payment.id);
    const second = await service.ensureInvoiceForPaidPayment(payment.id);

    expect(first.outcome).toBe("created");
    expect(second.outcome).toBe("existing");
    expect(second.invoice.id).toBe(first.invoice.id);
  });

  it("records provider failure without changing payment away from paid", async () => {
    const paymentRepository = new InMemoryPaymentRepository();
    const invoiceRepository = new InMemoryInvoiceRepository();
    const payment = await createPaidPayment(paymentRepository, {
      id: "pay_invoice_failure",
      description: "בדיקת כשל [mock-invoice-fail]"
    });
    const service = new InvoiceService({
      paymentRepository,
      invoiceRepository,
      invoiceProvider: new MockInvoiceProvider()
    });

    const result = await service.ensureInvoiceForPaidPayment(payment.id);
    const storedPayment = await paymentRepository.findById(payment.id);

    expect(result.outcome).toBe("failed");
    expect(result.invoice.status).toBe("failed");
    expect(result.invoice.failureReason).toContain("failure");
    expect(storedPayment?.status).toBe("paid");
    expect(storedPayment?.invoiceId).toBeNull();
  });

  it("stores raw provider response on success", async () => {
    const paymentRepository = new InMemoryPaymentRepository();
    const invoiceRepository = new InMemoryInvoiceRepository();
    const payment = await createPaidPayment(paymentRepository, {
      id: "pay_invoice_raw"
    });
    const service = new InvoiceService({
      paymentRepository,
      invoiceRepository,
      invoiceProvider: new MockInvoiceProvider()
    });

    const result = await service.ensureInvoiceForPaidPayment(payment.id);

    expect(result.invoice.rawPayload).toContain("Mock invoice provider only");
  });
});
