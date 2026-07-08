import { describe, expect, it } from "vitest";

import { PaymentService } from "../src/domain/payments/payment-service";
import { InMemoryPaymentRepository } from "../src/infrastructure/db/in-memory-payment-repository";
import { InMemoryCustomerRepository } from "../src/infrastructure/db/in-memory-customer-repository";
import { MockPaymentProvider } from "../src/infrastructure/grow/mock-payment-provider";

describe("PaymentService", () => {
  it("creates a draft, resolves a customer and attaches provider details", async () => {
    const paymentRepository = new InMemoryPaymentRepository();
    const customerRepository = new InMemoryCustomerRepository();
    const service = new PaymentService({
      paymentRepository,
      customerRepository,
      paymentProvider: new MockPaymentProvider()
    });

    const payment = await service.createPaymentRequest({
      customerName: "יעל ישראלי",
      customerPhone: "0501234567",
      customerEmail: "yael@example.com",
      amountAgorot: 125000,
      currency: "ILS",
      description: "שכר טרחה"
    });

    expect(payment?.status).toBe("payment_created");
    expect(payment?.customerId).toMatch(/^cus_/);
    expect(payment?.providerPaymentId).toMatch(/^mockpay_/);

    const secondPayment = await service.createPaymentRequest({
      customerName: "יעל ישראלי",
      customerPhone: "0501234567",
      customerEmail: "yael@example.com",
      amountAgorot: 225000,
      currency: "ILS",
      description: "תשלום נוסף"
    });

    expect(secondPayment?.customerId).toBe(payment?.customerId);
  });
});
