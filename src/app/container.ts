import { InMemoryPaymentRepository } from "../infrastructure/db/in-memory-payment-repository";
import { MockCRMProvider } from "../infrastructure/crm/mock-crm-provider";
import { MockInvoiceProvider } from "../infrastructure/invoices/mock-invoice-provider";
import { MockPaymentProvider } from "../infrastructure/grow/mock-payment-provider";
import { PaymentService } from "../domain/payments/payment-service";

export function createContainer() {
  const paymentRepository = new InMemoryPaymentRepository();
  const paymentProvider = new MockPaymentProvider();
  const invoiceProvider = new MockInvoiceProvider();
  const crmProvider = new MockCRMProvider();

  return {
    paymentRepository,
    paymentProvider,
    invoiceProvider,
    crmProvider,
    paymentService: new PaymentService({
      paymentRepository,
      paymentProvider
    })
  };
}
