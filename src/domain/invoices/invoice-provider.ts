export interface CreateReceiptInput {
  paymentId: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  amountAgorot: number;
  currency: string;
  description: string;
  providerPaymentId: string | null;
  providerTransactionId: string | null;
}

export interface ProviderReceiptResult {
  providerInvoiceId: string;
  invoiceNumber: string;
  invoiceUrl: string;
  status: "created" | "pending" | "failed" | "cancelled";
  rawResponse: Record<string, unknown> | null;
}

export interface InvoiceProvider {
  readonly providerKey: string;
  createReceipt(input: CreateReceiptInput): Promise<ProviderReceiptResult>;
  getReceipt(invoiceNumber: string): Promise<ProviderReceiptResult | null>;
}
