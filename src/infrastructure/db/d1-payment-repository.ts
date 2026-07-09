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

interface D1PaymentRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  amount_agorot: number;
  currency: Payment["currency"];
  description: string;
  status: Payment["status"];
  provider: string;
  provider_payment_id: string | null;
  provider_transaction_id: string | null;
  payment_url: string | null;
  invoice_id: string | null;
  external_crm_deal_id: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
  failed_at: string | null;
}

interface D1WebhookRow {
  id: string;
  payment_id: string | null;
  provider: string;
  provider_event_id: string | null;
  provider_transaction_id: string | null;
  event_type: string;
  raw_payload: string;
  received_at: string;
  processed_at: string | null;
  processing_status: PaymentWebhookRecord["processingStatus"];
  processing_error: string | null;
}

function mapPaymentRow(row: D1PaymentRow): Payment {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    amountAgorot: row.amount_agorot,
    currency: row.currency,
    description: row.description,
    status: row.status,
    provider: row.provider,
    providerPaymentId: row.provider_payment_id,
    providerTransactionId: row.provider_transaction_id,
    paymentUrl: row.payment_url,
    invoiceId: row.invoice_id,
    externalCrmDealId: row.external_crm_deal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at,
    cancelledAt: row.cancelled_at,
    failedAt: row.failed_at
  };
}

function mapWebhookRow(row: D1WebhookRow): PaymentWebhookRecord {
  return {
    id: row.id,
    paymentId: row.payment_id,
    provider: row.provider,
    providerEventId: row.provider_event_id,
    providerTransactionId: row.provider_transaction_id,
    eventType: row.event_type,
    rawPayload: row.raw_payload,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
    processingStatus: row.processing_status,
    processingError: row.processing_error
  };
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Error && /unique/i.test(error.message);
}

export class D1PaymentRepository implements PaymentRepository {
  constructor(private readonly db: D1Database) {}

  async create(input: CreatePaymentRecordInput): Promise<Payment> {
    try {
      await this.db
        .prepare(
          `
            INSERT INTO payments (
              id,
              customer_id,
              customer_name,
              customer_phone,
              customer_email,
              amount_agorot,
              currency,
              description,
              status,
              provider,
              provider_payment_id,
              provider_transaction_id,
              payment_url,
              invoice_id,
              external_crm_deal_id,
              created_at,
              updated_at,
              paid_at,
              cancelled_at,
              failed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .bind(
          input.id,
          input.customerId ?? null,
          input.customerName,
          input.customerPhone ?? null,
          input.customerEmail ?? null,
          input.amountAgorot,
          input.currency,
          input.description,
          input.status,
          input.provider,
          input.providerPaymentId,
          input.providerTransactionId,
          input.paymentUrl,
          input.invoiceId ?? null,
          input.externalCrmDealId ?? null,
          input.createdAt,
          input.updatedAt,
          input.paidAt ?? null,
          input.cancelledAt ?? null,
          input.failedAt ?? null
        )
        .run();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError("מפתח ספק כבר קיים במסד הנתונים.", 409);
      }

      throw error;
    }

    return (await this.findById(input.id)) as Payment;
  }

  async findById(id: string): Promise<Payment | null> {
    const row = await this.db
      .prepare(
        `
          SELECT
            id,
            customer_id,
            customer_name,
            customer_phone,
            customer_email,
            amount_agorot,
            currency,
            description,
            status,
            provider,
            provider_payment_id,
            provider_transaction_id,
            payment_url,
            invoice_id,
            external_crm_deal_id,
            created_at,
            updated_at,
            paid_at,
            cancelled_at,
            failed_at
          FROM payments
          WHERE id = ?
        `
      )
      .bind(id)
      .first<D1PaymentRow>();

    return row ? mapPaymentRow(row) : null;
  }

  async findByProviderPaymentId(
    providerPaymentId: string
  ): Promise<Payment | null> {
    const row = await this.db
      .prepare(
        `
          SELECT
            id,
            customer_id,
            customer_name,
            customer_phone,
            customer_email,
            amount_agorot,
            currency,
            description,
            status,
            provider,
            provider_payment_id,
            provider_transaction_id,
            payment_url,
            invoice_id,
            external_crm_deal_id,
            created_at,
            updated_at,
            paid_at,
            cancelled_at,
            failed_at
          FROM payments
          WHERE provider_payment_id = ?
          LIMIT 1
        `
      )
      .bind(providerPaymentId)
      .first<D1PaymentRow>();

    return row ? mapPaymentRow(row) : null;
  }

  async findByProviderTransactionId(
    providerTransactionId: string
  ): Promise<Payment | null> {
    const row = await this.db
      .prepare(
        `
          SELECT
            id,
            customer_id,
            customer_name,
            customer_phone,
            customer_email,
            amount_agorot,
            currency,
            description,
            status,
            provider,
            provider_payment_id,
            provider_transaction_id,
            payment_url,
            invoice_id,
            external_crm_deal_id,
            created_at,
            updated_at,
            paid_at,
            cancelled_at,
            failed_at
          FROM payments
          WHERE provider_transaction_id = ?
          LIMIT 1
        `
      )
      .bind(providerTransactionId)
      .first<D1PaymentRow>();

    return row ? mapPaymentRow(row) : null;
  }

  async updateStatus(input: UpdatePaymentStatusInput): Promise<Payment | null> {
    const existing = await this.findById(input.paymentId);

    if (!existing) {
      return null;
    }

    const updatedAt = input.updatedAt ?? new Date().toISOString();
    const paidAt =
      input.status === "paid"
        ? (input.paidAt ?? existing.paidAt ?? updatedAt)
        : existing.paidAt;
    const cancelledAt =
      input.status === "cancelled"
        ? (input.cancelledAt ?? existing.cancelledAt ?? updatedAt)
        : existing.cancelledAt;
    const failedAt =
      input.status === "failed"
        ? (input.failedAt ?? existing.failedAt ?? updatedAt)
        : existing.failedAt;

    try {
      await this.db
        .prepare(
          `
            UPDATE payments
            SET
              status = ?,
              provider_transaction_id = COALESCE(?, provider_transaction_id),
              updated_at = ?,
              paid_at = ?,
              cancelled_at = ?,
              failed_at = ?
            WHERE id = ?
          `
        )
        .bind(
          input.status,
          input.providerTransactionId ?? null,
          updatedAt,
          paidAt,
          cancelledAt,
          failedAt,
          input.paymentId
        )
        .run();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError("provider_transaction_id כבר קיים.", 409);
      }

      throw error;
    }

    return this.findById(input.paymentId);
  }

  async attachProviderPaymentDetails(
    input: AttachProviderPaymentDetailsInput
  ): Promise<Payment | null> {
    try {
      await this.db
        .prepare(
          `
            UPDATE payments
            SET
              status = ?,
              provider_payment_id = ?,
              provider_transaction_id = ?,
              payment_url = ?,
              updated_at = ?
            WHERE id = ?
          `
        )
        .bind(
          input.status,
          input.providerPaymentId,
          input.providerTransactionId,
          input.paymentUrl,
          input.updatedAt,
          input.paymentId
        )
        .run();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError("provider_transaction_id כבר קיים.", 409);
      }

      throw error;
    }

    return this.findById(input.paymentId);
  }

  async attachInvoiceId(input: AttachInvoiceIdInput): Promise<Payment | null> {
    await this.db
      .prepare(
        `
          UPDATE payments
          SET
            invoice_id = ?,
            updated_at = ?
          WHERE id = ?
        `
      )
      .bind(input.invoiceId, input.updatedAt, input.paymentId)
      .run();

    return this.findById(input.paymentId);
  }

  async list(options: PaymentListOptions = {}): Promise<PaymentListResult> {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 5000));
    const offset = Math.max(0, options.offset ?? 0);

    const sortFieldMap: Record<string, string> = {
      created_at: "created_at",
      customer_name: "customer_name",
      amount_agorot: "amount_agorot",
      status: "status"
    };
    const sortField =
      sortFieldMap[options.sortBy ?? "created_at"] ?? "created_at";
    const sortDir = options.sortDir === "asc" ? "ASC" : "DESC";

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options.status) {
      conditions.push("status = ?");
      params.push(options.status);
    }
    if (options.dateFrom) {
      conditions.push("DATE(created_at) >= ?");
      params.push(options.dateFrom);
    }
    if (options.dateTo) {
      conditions.push("DATE(created_at) <= ?");
      params.push(options.dateTo);
    }
    if (options.customer) {
      conditions.push("LOWER(customer_name) LIKE ?");
      params.push(`%${options.customer.toLowerCase()}%`);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT
        id, customer_id, customer_name, customer_phone, customer_email,
        amount_agorot, currency, description, status, provider,
        provider_payment_id, provider_transaction_id, payment_url,
        invoice_id, external_crm_deal_id, created_at, updated_at,
        paid_at, cancelled_at, failed_at
      FROM payments
      ${where}
      ORDER BY ${sortField} ${sortDir}
      LIMIT ? OFFSET ?
    `;

    const result = await this.db
      .prepare(sql)
      .bind(...params, limit + 1, offset)
      .all<D1PaymentRow>();

    const rows = result.results ?? [];

    return {
      items: rows.slice(0, limit).map(mapPaymentRow),
      limit,
      offset,
      hasMore: rows.length > limit
    };
  }

  async listDistinctCustomerNames(limit = 200): Promise<string[]> {
    const result = await this.db
      .prepare(
        `
          SELECT DISTINCT customer_name
          FROM payments
          ORDER BY customer_name
          LIMIT ?
        `
      )
      .bind(Math.max(1, limit))
      .all<{ customer_name: string }>();

    return (result.results ?? []).map((r) => r.customer_name);
  }

  async createWebhookRecord(
    input: CreatePaymentWebhookInput
  ): Promise<PaymentWebhookRecord> {
    try {
      await this.db
        .prepare(
          `
            INSERT INTO payment_webhooks (
              id,
              payment_id,
              provider,
              provider_event_id,
              provider_transaction_id,
              event_type,
              raw_payload,
              received_at,
              processed_at,
              processing_status,
              processing_error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .bind(
          input.id,
          input.paymentId ?? null,
          input.provider,
          input.providerEventId ?? null,
          input.providerTransactionId ?? null,
          input.eventType,
          input.rawPayload,
          input.receivedAt,
          input.processedAt ?? null,
          input.processingStatus ?? "received",
          input.processingError ?? null
        )
        .run();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError("provider_event_id כבר קיים.", 409);
      }

      throw error;
    }

    const row = await this.db
      .prepare(
        `
          SELECT
            id,
            payment_id,
            provider,
            provider_event_id,
            provider_transaction_id,
            event_type,
            raw_payload,
            received_at,
            processed_at,
            processing_status,
            processing_error
          FROM payment_webhooks
          WHERE id = ?
        `
      )
      .bind(input.id)
      .first<D1WebhookRow>();

    return mapWebhookRow(row as D1WebhookRow);
  }

  async findWebhookByProviderEventId(
    provider: string,
    providerEventId: string
  ): Promise<PaymentWebhookRecord | null> {
    const row = await this.db
      .prepare(
        `
          SELECT
            id,
            payment_id,
            provider,
            provider_event_id,
            provider_transaction_id,
            event_type,
            raw_payload,
            received_at,
            processed_at,
            processing_status,
            processing_error
          FROM payment_webhooks
          WHERE provider = ?
            AND provider_event_id = ?
          LIMIT 1
        `
      )
      .bind(provider, providerEventId)
      .first<D1WebhookRow>();

    return row ? mapWebhookRow(row) : null;
  }

  async listWebhooksByPaymentId(
    paymentId: string,
    limit = 10
  ): Promise<PaymentWebhookRecord[]> {
    const result = await this.db
      .prepare(
        `
          SELECT
            id,
            payment_id,
            provider,
            provider_event_id,
            provider_transaction_id,
            event_type,
            raw_payload,
            received_at,
            processed_at,
            processing_status,
            processing_error
          FROM payment_webhooks
          WHERE payment_id = ?
          ORDER BY received_at DESC
          LIMIT ?
        `
      )
      .bind(paymentId, Math.max(1, Math.min(limit, 50)))
      .all<D1WebhookRow>();

    return (result.results ?? []).map(mapWebhookRow);
  }

  async markWebhookProcessed(
    webhookId: string,
    processedAt: string
  ): Promise<PaymentWebhookRecord | null> {
    await this.db
      .prepare(
        `
          UPDATE payment_webhooks
          SET
            processed_at = ?,
            processing_status = 'processed',
            processing_error = NULL
          WHERE id = ?
        `
      )
      .bind(processedAt, webhookId)
      .run();

    const row = await this.db
      .prepare(
        `
          SELECT
            id,
            payment_id,
            provider,
            provider_event_id,
            provider_transaction_id,
            event_type,
            raw_payload,
            received_at,
            processed_at,
            processing_status,
            processing_error
          FROM payment_webhooks
          WHERE id = ?
        `
      )
      .bind(webhookId)
      .first<D1WebhookRow>();

    return row ? mapWebhookRow(row) : null;
  }

  async markWebhookFailed(
    webhookId: string,
    processingError: string,
    processedAt: string
  ): Promise<PaymentWebhookRecord | null> {
    await this.db
      .prepare(
        `
          UPDATE payment_webhooks
          SET
            processed_at = ?,
            processing_status = 'failed',
            processing_error = ?
          WHERE id = ?
        `
      )
      .bind(processedAt, processingError, webhookId)
      .run();

    const row = await this.db
      .prepare(
        `
          SELECT
            id,
            payment_id,
            provider,
            provider_event_id,
            provider_transaction_id,
            event_type,
            raw_payload,
            received_at,
            processed_at,
            processing_status,
            processing_error
          FROM payment_webhooks
          WHERE id = ?
        `
      )
      .bind(webhookId)
      .first<D1WebhookRow>();

    return row ? mapWebhookRow(row) : null;
  }
}
