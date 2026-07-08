import type {
  CreatePaymentRecordInput,
  PaymentRepository
} from "../../domain/payments/payment-repository";
import type {
  Payment,
  UpdatePaymentStatusInput
} from "../../domain/payments/payment-types";

export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly payments = new Map<string, Payment>();

  async create(input: CreatePaymentRecordInput): Promise<Payment> {
    const payment: Payment = {
      id: input.id,
      customerName: input.customerName,
      customerPhone: input.customerPhone ?? null,
      customerEmail: input.customerEmail ?? null,
      amountAgorot: input.amountAgorot,
      currency: input.currency,
      description: input.description,
      status: input.status,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      providerTransactionId: input.providerTransactionId,
      paymentUrl: input.paymentUrl,
      invoiceId: input.invoiceId ?? null,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      paidAt: input.paidAt ?? null
    };

    this.payments.set(payment.id, payment);
    return payment;
  }

  async updateStatus(input: UpdatePaymentStatusInput): Promise<Payment | null> {
    const existing = this.payments.get(input.paymentId);

    if (!existing) {
      return null;
    }

    const updated: Payment = {
      ...existing,
      status: input.status,
      providerTransactionId:
        input.providerTransactionId ?? existing.providerTransactionId,
      paidAt: input.paidAt ?? existing.paidAt,
      updatedAt: new Date().toISOString()
    };

    this.payments.set(updated.id, updated);
    return updated;
  }

  async findById(id: string): Promise<Payment | null> {
    return this.payments.get(id) ?? null;
  }

  async findByProviderTransactionId(
    providerTransactionId: string
  ): Promise<Payment | null> {
    for (const payment of this.payments.values()) {
      if (payment.providerTransactionId === providerTransactionId) {
        return payment;
      }
    }

    return null;
  }

  async list(): Promise<Payment[]> {
    return [...this.payments.values()].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
  }
}
