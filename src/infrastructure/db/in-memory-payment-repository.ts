import { AppError } from "../../shared/errors/app-error";
import type {
  AttachInvoiceIdInput,
  AttachProviderPaymentDetailsInput,
  CreatePaymentRecordInput,
  PaymentListOptions,
  PaymentListResult,
  PaymentRepository
} from "../../domain/payments/payment-repository";
import type {
  CreatePaymentWebhookInput,
  PaymentWebhookRecord
} from "../../domain/payments/payment-webhook-types";
import type {
  Payment,
  UpdatePaymentStatusInput
} from "../../domain/payments/payment-types";

function applyLifecycleTimestamps(
  existing: Payment,
  input: UpdatePaymentStatusInput
): Payment {
  const timestamp = input.updatedAt ?? new Date().toISOString();

  return {
    ...existing,
    status: input.status,
    providerTransactionId:
      input.providerTransactionId ?? existing.providerTransactionId,
    updatedAt: timestamp,
    paidAt:
      input.status === "paid"
        ? (input.paidAt ?? existing.paidAt ?? timestamp)
        : existing.paidAt,
    cancelledAt:
      input.status === "cancelled"
        ? (input.cancelledAt ?? existing.cancelledAt ?? timestamp)
        : existing.cancelledAt,
    failedAt:
      input.status === "failed"
        ? (input.failedAt ?? existing.failedAt ?? timestamp)
        : existing.failedAt
  };
}

export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly payments = new Map<string, Payment>();
  private readonly webhooks = new Map<string, PaymentWebhookRecord>();

  async create(input: CreatePaymentRecordInput): Promise<Payment> {
    if (input.providerTransactionId) {
      const duplicate = await this.findByProviderTransactionId(
        input.providerTransactionId
      );
      if (duplicate) {
        throw new AppError("provider_transaction_id כבר קיים.", 409);
      }
    }

    const payment: Payment = {
      id: input.id,
      customerId: input.customerId ?? null,
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
      externalCrmDealId: input.externalCrmDealId ?? null,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      paidAt: input.paidAt ?? null,
      cancelledAt: input.cancelledAt ?? null,
      failedAt: input.failedAt ?? null
    };

    this.payments.set(payment.id, payment);
    return payment;
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

  async updateStatus(input: UpdatePaymentStatusInput): Promise<Payment | null> {
    const existing = this.payments.get(input.paymentId);

    if (!existing) {
      return null;
    }

    const updated = applyLifecycleTimestamps(existing, input);
    this.payments.set(updated.id, updated);
    return updated;
  }

  async attachProviderPaymentDetails(
    input: AttachProviderPaymentDetailsInput
  ): Promise<Payment | null> {
    const existing = this.payments.get(input.paymentId);

    if (!existing) {
      return null;
    }

    if (input.providerTransactionId) {
      const duplicate = await this.findByProviderTransactionId(
        input.providerTransactionId
      );
      if (duplicate && duplicate.id !== input.paymentId) {
        throw new AppError("provider_transaction_id כבר קיים.", 409);
      }
    }

    const updated: Payment = {
      ...existing,
      status: input.status,
      providerPaymentId: input.providerPaymentId,
      providerTransactionId: input.providerTransactionId,
      paymentUrl: input.paymentUrl,
      updatedAt: input.updatedAt
    };

    this.payments.set(updated.id, updated);
    return updated;
  }

  async attachInvoiceId(input: AttachInvoiceIdInput): Promise<Payment | null> {
    const existing = this.payments.get(input.paymentId);

    if (!existing) {
      return null;
    }

    const updated: Payment = {
      ...existing,
      invoiceId: input.invoiceId,
      updatedAt: input.updatedAt
    };

    this.payments.set(updated.id, updated);
    return updated;
  }

  async list(options: PaymentListOptions = {}): Promise<PaymentListResult> {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
    const offset = Math.max(0, options.offset ?? 0);
    const filtered = [...this.payments.values()]
      .filter((payment) => !options.status || payment.status === options.status)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const page = filtered.slice(offset, offset + limit + 1);

    return {
      items: page.slice(0, limit),
      limit,
      offset,
      hasMore: page.length > limit
    };
  }

  async createWebhookRecord(
    input: CreatePaymentWebhookInput
  ): Promise<PaymentWebhookRecord> {
    if (input.providerEventId) {
      for (const webhook of this.webhooks.values()) {
        if (
          webhook.provider === input.provider &&
          webhook.providerEventId === input.providerEventId
        ) {
          throw new AppError("provider_event_id כבר קיים.", 409);
        }
      }
    }

    const webhook: PaymentWebhookRecord = {
      id: input.id,
      paymentId: input.paymentId ?? null,
      provider: input.provider,
      providerEventId: input.providerEventId ?? null,
      providerTransactionId: input.providerTransactionId ?? null,
      eventType: input.eventType,
      rawPayload: input.rawPayload,
      receivedAt: input.receivedAt,
      processedAt: input.processedAt ?? null,
      processingStatus: input.processingStatus ?? "received",
      processingError: input.processingError ?? null
    };

    this.webhooks.set(webhook.id, webhook);
    return webhook;
  }

  async markWebhookProcessed(
    webhookId: string,
    processedAt: string
  ): Promise<PaymentWebhookRecord | null> {
    const existing = this.webhooks.get(webhookId);

    if (!existing) {
      return null;
    }

    const updated: PaymentWebhookRecord = {
      ...existing,
      processedAt,
      processingStatus: "processed",
      processingError: null
    };

    this.webhooks.set(updated.id, updated);
    return updated;
  }

  async markWebhookFailed(
    webhookId: string,
    processingError: string,
    processedAt: string
  ): Promise<PaymentWebhookRecord | null> {
    const existing = this.webhooks.get(webhookId);

    if (!existing) {
      return null;
    }

    const updated: PaymentWebhookRecord = {
      ...existing,
      processedAt,
      processingStatus: "failed",
      processingError
    };

    this.webhooks.set(updated.id, updated);
    return updated;
  }
}
