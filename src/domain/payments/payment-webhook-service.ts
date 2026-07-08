import { createId } from "../../shared/types/entity-id";
import { AppError } from "../../shared/errors/app-error";
import type { PaymentRepository } from "./payment-repository";
import type { Payment } from "./payment-types";
import type { PaymentWebhookRecord } from "./payment-webhook-types";
import {
  assertWebhookPaymentMatch,
  assertWebhookStatusTransition,
  isIdempotentFinalStatusMatch
} from "./payment-webhook-validation";
import type { ParsedMockGrowWebhook } from "../../infrastructure/grow/mock-grow-webhook-parser";
import type {
  InvoiceAttemptResult,
  InvoiceService
} from "../invoices/invoice-service";

export type ProcessMockWebhookResult =
  | {
      outcome: "processed";
      payment: Payment;
      webhook: PaymentWebhookRecord;
      duplicate: false;
      message: string;
      invoiceAttempt?: InvoiceAttemptResult;
    }
  | {
      outcome: "duplicate";
      payment: Payment | null;
      webhook: PaymentWebhookRecord;
      duplicate: true;
      message: string;
      invoiceAttempt?: undefined;
    }
  | {
      outcome: "failed";
      payment: Payment | null;
      webhook: PaymentWebhookRecord;
      duplicate: false;
      message: string;
      invoiceAttempt?: InvoiceAttemptResult;
    };

export class PaymentWebhookService {
  constructor(
    private readonly dependencies: {
      paymentRepository: PaymentRepository;
      parseMockGrowWebhookPayload: (payload: unknown) => ParsedMockGrowWebhook;
      invoiceService: InvoiceService;
    }
  ) {}

  async processMockGrowWebhook(
    payload: unknown
  ): Promise<ProcessMockWebhookResult> {
    const parsed = this.dependencies.parseMockGrowWebhookPayload(payload);
    const duplicate =
      await this.dependencies.paymentRepository.findWebhookByProviderEventId(
        parsed.provider,
        parsed.eventId
      );

    if (duplicate) {
      const payment = duplicate.paymentId
        ? await this.dependencies.paymentRepository.findById(
            duplicate.paymentId
          )
        : null;

      return {
        outcome: "duplicate",
        payment,
        webhook: duplicate,
        duplicate: true,
        message: "אירוע webhook כפול זוהה ולא עובד מחדש."
      };
    }

    const payment = await this.findPaymentForWebhook(parsed);
    const webhook =
      await this.dependencies.paymentRepository.createWebhookRecord({
        id: createId("wh"),
        paymentId: payment?.id ?? null,
        provider: parsed.provider,
        providerEventId: parsed.eventId,
        providerTransactionId: parsed.providerTransactionId,
        eventType: parsed.eventType,
        rawPayload: parsed.rawPayload,
        receivedAt: new Date().toISOString()
      });

    try {
      if (!payment) {
        throw new AppError("לא נמצא תשלום מתאים עבור ה-webhook.", 404);
      }

      assertWebhookPaymentMatch(payment, parsed);

      if (isIdempotentFinalStatusMatch(payment.status, parsed.status)) {
        const processed =
          await this.dependencies.paymentRepository.markWebhookProcessed(
            webhook.id,
            new Date().toISOString()
          );

        return {
          outcome: "processed",
          payment,
          webhook: processed ?? webhook,
          duplicate: false,
          message: "האירוע תואם לסטטוס סופי קיים ולכן טופל באופן idempotent."
        };
      }

      assertWebhookStatusTransition(payment.status, parsed.status);

      const updatedPayment =
        await this.dependencies.paymentRepository.updateStatus({
          paymentId: payment.id,
          status: parsed.status,
          providerTransactionId:
            parsed.providerTransactionId ?? payment.providerTransactionId,
          updatedAt: parsed.occurredAt,
          paidAt: parsed.status === "paid" ? parsed.occurredAt : null,
          failedAt: parsed.status === "failed" ? parsed.occurredAt : null,
          cancelledAt: parsed.status === "cancelled" ? parsed.occurredAt : null
        });

      if (!updatedPayment) {
        throw new AppError("התשלום לא נמצא בזמן עדכון הסטטוס.", 404);
      }

      const processed =
        await this.dependencies.paymentRepository.markWebhookProcessed(
          webhook.id,
          new Date().toISOString()
        );

      let invoiceAttempt: InvoiceAttemptResult | undefined;
      let message = "ה-webhook עובד בהצלחה וסטטוס התשלום עודכן.";
      let responsePayment = updatedPayment;

      if (updatedPayment.status === "paid") {
        try {
          invoiceAttempt =
            await this.dependencies.invoiceService.ensureInvoiceForPaymentRecord(
              updatedPayment
            );
          responsePayment =
            invoiceAttempt.outcome === "failed"
              ? updatedPayment
              : invoiceAttempt.payment;
          message =
            invoiceAttempt.outcome === "failed"
              ? "התשלום סומן כשולם, אך יצירת הקבלה המדומה נכשלה."
              : "ה-webhook עובד בהצלחה, סטטוס התשלום עודכן, וטופלה יצירת קבלה מדומה.";
        } catch (error) {
          message =
            error instanceof AppError
              ? `התשלום סומן כשולם, אך יצירת הקבלה נתקלה בשגיאה: ${error.message}`
              : "התשלום סומן כשולם, אך יצירת הקבלה נתקלה בשגיאה לא ידועה.";
        }
      }

      return {
        outcome: "processed",
        payment: responsePayment,
        webhook: processed ?? webhook,
        duplicate: false,
        message,
        invoiceAttempt
      };
    } catch (error) {
      const message =
        error instanceof AppError
          ? error.message
          : "עיבוד ה-webhook נכשל מסיבה לא ידועה.";

      const failedWebhook =
        await this.dependencies.paymentRepository.markWebhookFailed(
          webhook.id,
          message,
          new Date().toISOString()
        );

      return {
        outcome: "failed",
        payment,
        webhook: failedWebhook ?? webhook,
        duplicate: false,
        message
      };
    }
  }

  async listPaymentWebhooks(paymentId: string, limit = 10) {
    return this.dependencies.paymentRepository.listWebhooksByPaymentId(
      paymentId,
      limit
    );
  }

  private async findPaymentForWebhook(parsed: ParsedMockGrowWebhook) {
    if (parsed.providerPaymentId) {
      const byPaymentId =
        await this.dependencies.paymentRepository.findByProviderPaymentId(
          parsed.providerPaymentId
        );

      if (byPaymentId) {
        return byPaymentId;
      }
    }

    if (parsed.providerTransactionId) {
      return this.dependencies.paymentRepository.findByProviderTransactionId(
        parsed.providerTransactionId
      );
    }

    return null;
  }
}
