import type { CustomerRepository } from "../domain/customers/customer-repository";
import type { PaymentRepository } from "../domain/payments/payment-repository";
import { InMemoryPaymentRepository } from "../infrastructure/db/in-memory-payment-repository";
import { InMemoryCustomerRepository } from "../infrastructure/db/in-memory-customer-repository";
import { MockCRMProvider } from "../infrastructure/crm/mock-crm-provider";
import { MockInvoiceProvider } from "../infrastructure/invoices/mock-invoice-provider";
import { MockPaymentProvider } from "../infrastructure/grow/mock-payment-provider";
import { PaymentService } from "../domain/payments/payment-service";
import { D1PaymentRepository } from "../infrastructure/db/d1-payment-repository";
import { D1CustomerRepository } from "../infrastructure/db/d1-customer-repository";
import { PaymentWebhookService } from "../domain/payments/payment-webhook-service";
import { parseMockGrowWebhookPayload } from "../infrastructure/grow/mock-grow-webhook-parser";
import { InvoiceService } from "../domain/invoices/invoice-service";
import type { InvoiceRepository } from "../domain/invoices/invoice-repository";
import { D1InvoiceRepository } from "../infrastructure/db/d1-invoice-repository";
import { InMemoryInvoiceRepository } from "../infrastructure/db/in-memory-invoice-repository";

export function createContainer(
  env?: Env,
  overrides?: {
    paymentRepository?: PaymentRepository;
    customerRepository?: CustomerRepository;
    invoiceRepository?: InvoiceRepository;
  }
) {
  const paymentRepository =
    overrides?.paymentRepository ??
    (env?.DB
      ? new D1PaymentRepository(env.DB)
      : new InMemoryPaymentRepository());
  const customerRepository =
    overrides?.customerRepository ??
    (env?.DB
      ? new D1CustomerRepository(env.DB)
      : new InMemoryCustomerRepository());
  const invoiceRepository =
    overrides?.invoiceRepository ??
    (env?.DB
      ? new D1InvoiceRepository(env.DB)
      : new InMemoryInvoiceRepository());
  const paymentProvider = new MockPaymentProvider();
  const invoiceProvider = new MockInvoiceProvider();
  const crmProvider = new MockCRMProvider();
  const invoiceService = new InvoiceService({
    paymentRepository,
    invoiceRepository,
    invoiceProvider
  });

  return {
    paymentRepository,
    customerRepository,
    invoiceRepository,
    paymentProvider,
    invoiceProvider,
    crmProvider,
    paymentService: new PaymentService({
      paymentRepository,
      customerRepository,
      paymentProvider
    }),
    invoiceService,
    paymentWebhookService: new PaymentWebhookService({
      paymentRepository,
      parseMockGrowWebhookPayload,
      invoiceService
    })
  };
}

export type AppContainer = ReturnType<typeof createContainer>;
