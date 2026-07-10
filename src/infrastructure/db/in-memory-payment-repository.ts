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

  async findByProviderPaymentId(
    providerPaymentId: string
  ): Promise<Payment | null> {
    for (const payment of this.payments.values()) {
      if (payment.providerPaymentId === providerPaymentId) {
        return payment;
      }
    }

    return null;
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
    const limit = Math.max(1, Math.min(options.limit ?? 20, 5000));
    const offset = Math.max(0, options.offset ?? 0);

    const dateFrom = options.dateFrom
      ? new Date(`${options.dateFrom}T00:00:00Z`)
      : null;
    const dateTo = options.dateTo
      ? new Date(`${options.dateTo}T23:59:59Z`)
      : null;
    const customerLower = options.customer?.toLowerCase();

    const statusSet =
      options.statuses && options.statuses.length > 0
        ? new Set(options.statuses)
        : null;

    const filtered = [...this.payments.values()].filter((payment) => {
      if (statusSet && !statusSet.has(payment.status)) return false;
      if (dateFrom && new Date(payment.createdAt) < dateFrom) return false;
      if (dateTo && new Date(payment.createdAt) > dateTo) return false;
      if (
        customerLower &&
        !payment.customerName.toLowerCase().includes(customerLower)
      )
        return false;
      return true;
    });

    const sortBy = options.sortBy ?? "created_at";
    const ascending = options.sortDir === "asc";

    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "created_at") {
        cmp = a.createdAt.localeCompare(b.createdAt);
      } else if (sortBy === "customer_name") {
        cmp = a.customerName.localeCompare(b.customerName, "he");
      } else if (sortBy === "amount_agorot") {
        cmp = a.amountAgorot - b.amountAgorot;
      } else if (sortBy === "status") {
        cmp = a.status.localeCompare(b.status);
      }
      return ascending ? cmp : -cmp;
    });

    const page = filtered.slice(offset, offset + limit + 1);

    return {
      items: page.slice(0, limit),
      limit,
      offset,
      hasMore: page.length > limit
    };
  }

  async listDistinctCustomerNames(limit = 200): Promise<string[]> {
    const names = new Set<string>();
    for (const payment of this.payments.values()) {
      names.add(payment.customerName);
    }
    return [...names]
      .sort((a, b) => a.localeCompare(b, "he"))
      .slice(0, Math.max(1, limit));
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

  async findWebhookByProviderEventId(
    provider: string,
    providerEventId: string
  ): Promise<PaymentWebhookRecord | null> {
    for (const webhook of this.webhooks.values()) {
      if (
        webhook.provider === provider &&
        webhook.providerEventId === providerEventId
      ) {
        return webhook;
      }
    }

    return null;
  }

  async listWebhooksByPaymentId(
    paymentId: string,
    limit = 10
  ): Promise<PaymentWebhookRecord[]> {
    return [...this.webhooks.values()]
      .filter((webhook) => webhook.paymentId === paymentId)
      .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt))
      .slice(0, Math.max(1, Math.min(limit, 50)));
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
