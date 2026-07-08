export interface CreateReceiptInput {
  paymentId: string;
  customerName: string;
  customerEmail: string | null;
  amountAgorot: number;
  currency: string;
}

export interface InvoiceProvider {
  createReceipt(input: CreateReceiptInput): Promise<{
    receiptNumber: string;
    receiptUrl: string;
  }>;
  getReceipt(receiptNumber: string): Promise<{
    receiptNumber: string;
    receiptUrl: string;
  } | null>;
}
