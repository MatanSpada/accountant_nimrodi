import { AppError } from "../../shared/errors/app-error";
import type {
  CreateInvoiceRecordInput,
  InvoiceRepository,
  UpdateInvoiceRecordInput
} from "../../domain/invoices/invoice-repository";
import type { InvoiceRecord } from "../../domain/invoices/invoice-types";

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private readonly invoices = new Map<string, InvoiceRecord>();

  async create(input: CreateInvoiceRecordInput): Promise<InvoiceRecord> {
    const existingForPayment = await this.findByPaymentId(input.paymentId);
    if (existingForPayment) {
      throw new AppError("כבר קיימת קבלה עבור התשלום הזה.", 409);
    }

    if (input.providerInvoiceId) {
      const existingForProviderId = await this.findByProviderInvoiceId(
        input.providerInvoiceId
      );
      if (existingForProviderId) {
        throw new AppError("provider_invoice_id כבר קיים.", 409);
      }
    }

    const invoice: InvoiceRecord = {
      id: input.id,
      paymentId: input.paymentId,
      provider: input.provider,
      providerInvoiceId: input.providerInvoiceId ?? null,
      invoiceNumber: input.invoiceNumber ?? null,
      invoiceUrl: input.invoiceUrl ?? null,
      status: input.status,
      rawPayload: input.rawPayload ?? null,
      failureReason: input.failureReason ?? null,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt
    };

    this.invoices.set(invoice.id, invoice);
    return invoice;
  }

  async findById(invoiceId: string): Promise<InvoiceRecord | null> {
    return this.invoices.get(invoiceId) ?? null;
  }

  async findByPaymentId(paymentId: string): Promise<InvoiceRecord | null> {
    for (const invoice of this.invoices.values()) {
      if (invoice.paymentId === paymentId) {
        return invoice;
      }
    }

    return null;
  }

  async findByProviderInvoiceId(
    providerInvoiceId: string
  ): Promise<InvoiceRecord | null> {
    for (const invoice of this.invoices.values()) {
      if (invoice.providerInvoiceId === providerInvoiceId) {
        return invoice;
      }
    }

    return null;
  }

  async update(input: UpdateInvoiceRecordInput): Promise<InvoiceRecord | null> {
    const existing = this.invoices.get(input.invoiceId);

    if (!existing) {
      return null;
    }

    if (
      input.providerInvoiceId &&
      input.providerInvoiceId !== existing.providerInvoiceId
    ) {
      const duplicate = await this.findByProviderInvoiceId(
        input.providerInvoiceId
      );
      if (duplicate && duplicate.id !== existing.id) {
        throw new AppError("provider_invoice_id כבר קיים.", 409);
      }
    }

    const updated: InvoiceRecord = {
      ...existing,
      status: input.status,
      providerInvoiceId:
        input.providerInvoiceId === undefined
          ? existing.providerInvoiceId
          : input.providerInvoiceId,
      invoiceNumber:
        input.invoiceNumber === undefined
          ? existing.invoiceNumber
          : input.invoiceNumber,
      invoiceUrl:
        input.invoiceUrl === undefined ? existing.invoiceUrl : input.invoiceUrl,
      rawPayload:
        input.rawPayload === undefined ? existing.rawPayload : input.rawPayload,
      failureReason:
        input.failureReason === undefined
          ? existing.failureReason
          : input.failureReason,
      updatedAt: input.updatedAt
    };

    this.invoices.set(updated.id, updated);
    return updated;
  }
}
