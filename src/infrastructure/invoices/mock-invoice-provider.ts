import type {
  CreateReceiptInput,
  InvoiceProvider,
  ProviderReceiptResult
} from "../../domain/invoices/invoice-provider";

function createDeterministicInvoiceNumber(paymentId: string) {
  let checksum = 0;

  for (const char of paymentId) {
    checksum = (checksum * 33 + char.charCodeAt(0)) % 1000000;
  }

  return `MOCK-2026-${checksum.toString().padStart(6, "0")}`;
}

export class MockInvoiceProvider implements InvoiceProvider {
  readonly providerKey = "mock-invoice";

  async createReceipt(input: CreateReceiptInput) {
    if (input.description.includes("[mock-invoice-fail]")) {
      throw new Error("Mock invoice provider failure was requested.");
    }

    const providerInvoiceId = `mock_inv_${input.paymentId}`;
    const invoiceNumber = createDeterministicInvoiceNumber(input.paymentId);

    return {
      providerInvoiceId,
      invoiceNumber,
      invoiceUrl: `/dev/mock-invoices/${providerInvoiceId}`,
      status: "created",
      rawResponse: {
        note: "Mock invoice provider only. Real invoice provider fields must be verified with the client's system later.",
        providerInvoiceId,
        invoiceNumber
      }
    } satisfies ProviderReceiptResult;
  }

  async getReceipt(invoiceNumber: string) {
    return {
      providerInvoiceId: `mock_inv_lookup_${invoiceNumber}`,
      invoiceNumber,
      invoiceUrl: `/dev/mock-invoices/mock_inv_lookup_${invoiceNumber}`,
      status: "created",
      rawResponse: {
        note: "Mock invoice lookup only."
      }
    } satisfies ProviderReceiptResult;
  }
}
