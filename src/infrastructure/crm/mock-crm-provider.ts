import type { CRMProvider } from "../../domain/customers/crm-provider";

export class MockCRMProvider implements CRMProvider {
  async getCustomer(
    customerId: string
  ): Promise<Record<string, unknown> | null> {
    return {
      id: customerId,
      source: "mock-crm"
    };
  }

  async updateDealPaymentStatus(): Promise<void> {
    return;
  }
}
