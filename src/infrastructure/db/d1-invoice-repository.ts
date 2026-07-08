import { AppError } from "../../shared/errors/app-error";
import type {
  CreateInvoiceRecordInput,
  InvoiceRepository,
  UpdateInvoiceRecordInput
} from "../../domain/invoices/invoice-repository";
import type { InvoiceRecord } from "../../domain/invoices/invoice-types";

interface D1InvoiceRow {
  id: string;
  payment_id: string;
  provider: string;
  provider_invoice_id: string | null;
  invoice_number: string | null;
  invoice_url: string | null;
  status: InvoiceRecord["status"];
  raw_payload: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

function mapInvoiceRow(row: D1InvoiceRow): InvoiceRecord {
  return {
    id: row.id,
    paymentId: row.payment_id,
    provider: row.provider,
    providerInvoiceId: row.provider_invoice_id,
    invoiceNumber: row.invoice_number,
    invoiceUrl: row.invoice_url,
    status: row.status,
    rawPayload: row.raw_payload,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Error && /unique/i.test(error.message);
}

export class D1InvoiceRepository implements InvoiceRepository {
  constructor(private readonly db: D1Database) {}

  async create(input: CreateInvoiceRecordInput): Promise<InvoiceRecord> {
    try {
      await this.db
        .prepare(
          `
            INSERT INTO invoices (
              id,
              payment_id,
              provider,
              provider_invoice_id,
              invoice_number,
              invoice_url,
              status,
              raw_payload,
              failure_reason,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .bind(
          input.id,
          input.paymentId,
          input.provider,
          input.providerInvoiceId ?? null,
          input.invoiceNumber ?? null,
          input.invoiceUrl ?? null,
          input.status,
          input.rawPayload ?? null,
          input.failureReason ?? null,
          input.createdAt,
          input.updatedAt
        )
        .run();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError("כבר קיימת קבלה עבור התשלום הזה.", 409);
      }

      throw error;
    }

    return (await this.findById(input.id)) as InvoiceRecord;
  }

  async findById(invoiceId: string): Promise<InvoiceRecord | null> {
    const row = await this.db
      .prepare(
        `
          SELECT
            id,
            payment_id,
            provider,
            provider_invoice_id,
            invoice_number,
            invoice_url,
            status,
            raw_payload,
            failure_reason,
            created_at,
            updated_at
          FROM invoices
          WHERE id = ?
          LIMIT 1
        `
      )
      .bind(invoiceId)
      .first<D1InvoiceRow>();

    return row ? mapInvoiceRow(row) : null;
  }

  async findByPaymentId(paymentId: string): Promise<InvoiceRecord | null> {
    const row = await this.db
      .prepare(
        `
          SELECT
            id,
            payment_id,
            provider,
            provider_invoice_id,
            invoice_number,
            invoice_url,
            status,
            raw_payload,
            failure_reason,
            created_at,
            updated_at
          FROM invoices
          WHERE payment_id = ?
          LIMIT 1
        `
      )
      .bind(paymentId)
      .first<D1InvoiceRow>();

    return row ? mapInvoiceRow(row) : null;
  }

  async findByProviderInvoiceId(
    providerInvoiceId: string
  ): Promise<InvoiceRecord | null> {
    const row = await this.db
      .prepare(
        `
          SELECT
            id,
            payment_id,
            provider,
            provider_invoice_id,
            invoice_number,
            invoice_url,
            status,
            raw_payload,
            failure_reason,
            created_at,
            updated_at
          FROM invoices
          WHERE provider_invoice_id = ?
          LIMIT 1
        `
      )
      .bind(providerInvoiceId)
      .first<D1InvoiceRow>();

    return row ? mapInvoiceRow(row) : null;
  }

  async update(input: UpdateInvoiceRecordInput): Promise<InvoiceRecord | null> {
    try {
      await this.db
        .prepare(
          `
            UPDATE invoices
            SET
              status = ?,
              provider_invoice_id = COALESCE(?, provider_invoice_id),
              invoice_number = COALESCE(?, invoice_number),
              invoice_url = COALESCE(?, invoice_url),
              raw_payload = ?,
              failure_reason = ?,
              updated_at = ?
            WHERE id = ?
          `
        )
        .bind(
          input.status,
          input.providerInvoiceId ?? null,
          input.invoiceNumber ?? null,
          input.invoiceUrl ?? null,
          input.rawPayload ?? null,
          input.failureReason ?? null,
          input.updatedAt,
          input.invoiceId
        )
        .run();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError("provider_invoice_id כבר קיים.", 409);
      }

      throw error;
    }

    return this.findById(input.invoiceId);
  }
}
