import { createId } from "../../shared/types/entity-id";
import { AppError } from "../../shared/errors/app-error";
import type { PaymentRepository } from "../payments/payment-repository";
import type { Payment } from "../payments/payment-types";
import type { InvoiceProvider } from "./invoice-provider";
import type { InvoiceRepository } from "./invoice-repository";
import type { InvoiceRecord } from "./invoice-types";
import {
  assertInvoiceCreatablePayment,
  canRetryInvoice
} from "./invoice-validation";

export type InvoiceAttemptResult =
  | {
      outcome: "created";
      invoice: InvoiceRecord;
      payment: Payment;
      duplicate: false;
      message: string;
    }
  | {
      outcome: "existing";
      invoice: InvoiceRecord;
      payment: Payment;
      duplicate: true;
      message: string;
    }
  | {
      outcome: "failed";
      invoice: InvoiceRecord;
      payment: Payment;
      duplicate: false;
      message: string;
    };

export class InvoiceService {
  constructor(
    private readonly dependencies: {
      paymentRepository: PaymentRepository;
      invoiceRepository: InvoiceRepository;
      invoiceProvider: InvoiceProvider;
    }
  ) {}

  async ensureInvoiceForPaidPayment(
    paymentId: string
  ): Promise<InvoiceAttemptResult> {
    const payment =
      await this.dependencies.paymentRepository.findById(paymentId);

    if (!payment) {
      throw new AppError("בקשת התשלום לא נמצאה.", 404);
    }

    return this.ensureInvoiceForPaymentRecord(payment);
  }

  async ensureInvoiceForPaymentRecord(
    payment: Payment
  ): Promise<InvoiceAttemptResult> {
    assertInvoiceCreatablePayment(payment);

    if (
      this.dependencies.invoiceProvider.providerKey === "mock-invoice" &&
      payment.provider !== "mock-grow"
    ) {
      throw new AppError(
        "מסמך דמו זמין רק עבור תשלומי דמו. עבור GROW דרך Make נדרש חיבור מסמכים אמיתי.",
        422
      );
    }

    const existing = await this.dependencies.invoiceRepository.findByPaymentId(
      payment.id
    );

    if (existing?.status === "created") {
      if (!payment.invoiceId || payment.invoiceId !== existing.id) {
        await this.dependencies.paymentRepository.attachInvoiceId({
          paymentId: payment.id,
          invoiceId: existing.id,
          updatedAt: new Date().toISOString()
        });
      }

      return {
        outcome: "existing",
        invoice: existing,
        payment: {
          ...payment,
          invoiceId: existing.id
        },
        duplicate: true,
        message: "כבר קיימת קבלה עבור התשלום הזה."
      };
    }

    if (!canRetryInvoice(existing ?? null)) {
      throw new AppError("לא ניתן ליצור מחדש את הקבלה במצב הנוכחי.", 409);
    }

    const now = new Date().toISOString();
    const invoiceRecord =
      existing ??
      (await this.dependencies.invoiceRepository.create({
        id: createId("inv"),
        paymentId: payment.id,
        provider: this.dependencies.invoiceProvider.providerKey,
        providerInvoiceId: null,
        invoiceNumber: null,
        invoiceUrl: null,
        status: "pending",
        rawPayload: null,
        failureReason: null,
        createdAt: now,
        updatedAt: now
      }));

    const pendingInvoice =
      existing &&
      (await this.dependencies.invoiceRepository.update({
        invoiceId: existing.id,
        status: "pending",
        providerInvoiceId: existing.providerInvoiceId,
        invoiceNumber: existing.invoiceNumber,
        invoiceUrl: existing.invoiceUrl,
        rawPayload: existing.rawPayload,
        failureReason: null,
        updatedAt: now
      }));

    const targetInvoice = pendingInvoice ?? invoiceRecord;

    try {
      const providerResult =
        await this.dependencies.invoiceProvider.createReceipt({
          paymentId: payment.id,
          customerName: payment.customerName,
          customerPhone: payment.customerPhone,
          customerEmail: payment.customerEmail,
          amountAgorot: payment.amountAgorot,
          currency: payment.currency,
          description: payment.description,
          providerPaymentId: payment.providerPaymentId,
          providerTransactionId: payment.providerTransactionId
        });

      const updatedInvoice = await this.dependencies.invoiceRepository.update({
        invoiceId: targetInvoice.id,
        status: providerResult.status,
        providerInvoiceId: providerResult.providerInvoiceId,
        invoiceNumber: providerResult.invoiceNumber,
        invoiceUrl: providerResult.invoiceUrl,
        rawPayload: providerResult.rawResponse
          ? JSON.stringify(providerResult.rawResponse)
          : null,
        failureReason: null,
        updatedAt: new Date().toISOString()
      });

      if (!updatedInvoice) {
        throw new AppError("קבלת invoice לא נמצאה בזמן שמירת התוצאה.", 500);
      }

      const updatedPayment =
        await this.dependencies.paymentRepository.attachInvoiceId({
          paymentId: payment.id,
          invoiceId: updatedInvoice.id,
          updatedAt: new Date().toISOString()
        });

      return {
        outcome: "created",
        invoice: updatedInvoice,
        payment: updatedPayment ?? { ...payment, invoiceId: updatedInvoice.id },
        duplicate: false,
        message: "קבלה מדומה נוצרה בהצלחה."
      };
    } catch (error) {
      const message =
        error instanceof AppError
          ? error.message
          : error instanceof Error
            ? error.message
            : "יצירת הקבלה המדומה נכשלה.";

      const failedInvoice = await this.dependencies.invoiceRepository.update({
        invoiceId: targetInvoice.id,
        status: "failed",
        failureReason: message,
        rawPayload: JSON.stringify({
          note: "Mock invoice failure placeholder. Real provider responses must be verified later.",
          error: message
        }),
        updatedAt: new Date().toISOString()
      });

      if (!failedInvoice) {
        throw new AppError("קבלת invoice לא נמצאה בזמן סימון הכישלון.", 500);
      }

      return {
        outcome: "failed",
        invoice: failedInvoice,
        payment,
        duplicate: false,
        message
      };
    }
  }

  async getInvoiceById(invoiceId: string) {
    return this.dependencies.invoiceRepository.findById(invoiceId);
  }

  async getInvoiceByPaymentId(paymentId: string) {
    return this.dependencies.invoiceRepository.findByPaymentId(paymentId);
  }

  async getInvoiceByProviderInvoiceId(providerInvoiceId: string) {
    return this.dependencies.invoiceRepository.findByProviderInvoiceId(
      providerInvoiceId
    );
  }
}
