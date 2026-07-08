export interface CRMProvider {
  getCustomer(customerId: string): Promise<Record<string, unknown> | null>;
  updateDealPaymentStatus(input: {
    customerId: string;
    paymentId: string;
    status: string;
  }): Promise<void>;
}
