import type {
  CreateReceiptInput,
  InvoiceProvider
} from "../../domain/invoices/invoice-provider";

export class MockInvoiceProvider implements InvoiceProvider {
  async createReceipt(input: CreateReceiptInput) {
    const receiptNumber = `RCPT-${input.paymentId.slice(-6).toUpperCase()}`;

    return {
      receiptNumber,
      receiptUrl: `https://mock-payments.local/receipts/${receiptNumber}`
    };
  }

  async getReceipt(receiptNumber: string) {
    return {
      receiptNumber,
      receiptUrl: `https://mock-payments.local/receipts/${receiptNumber}`
    };
  }
}
