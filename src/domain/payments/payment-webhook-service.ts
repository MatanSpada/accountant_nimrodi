import { createId } from "../../shared/types/entity-id";
import { AppError } from "../../shared/errors/app-error";
import { logger } from "../../shared/logger/logger";
import type { PaymentRepository } from "./payment-repository";
import type { Payment } from "./payment-types";
import type { PaymentWebhookRecord } from "./payment-webhook-types";
import {
  assertWebhookPaymentMatch,
  assertWebhookStatusTransition,
  isIdempotentFinalStatusMatch
} from "./payment-webhook-validation";
import type { ParsedMockGrowWebhook } from "../../infrastructure/grow/mock-grow-webhook-parser";
import type { ParsedMakeGrowWebhook } from "../../infrastructure/grow/make-grow-webhook-parser";
import type {
  InvoiceAttemptResult,
  InvoiceService
} from "../invoices/invoice-service";
import type { PaymentProvider } from "./payment-provider";

type ParsedWebhook = ParsedMockGrowWebhook | ParsedMakeGrowWebhook;

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
      parseMakeGrowWebhookPayload: (payload: unknown) => ParsedMakeGrowWebhook;
      invoiceService: InvoiceService;
      paymentProvider: PaymentProvider;
    }
  ) {}

  async processMockGrowWebhook(
    payload: unknown
  ): Promise<ProcessMockWebhookResult> {
    const parsed = this.dependencies.parseMockGrowWebhookPayload(payload);
    return this.processParsedWebhook(parsed, {
      autoCreateInvoice: true,
      approveTransaction: false
    });
  }

  async processGrowWebhook(
    payload: unknown
  ): Promise<ProcessMockWebhookResult> {
    const parsed = this.dependencies.parseMakeGrowWebhookPayload(payload);
    return this.processParsedWebhook(parsed, {
      autoCreateInvoice: false,
      approveTransaction: true
    });
  }

  private async processParsedWebhook(
    parsed: ParsedWebhook,
    behavior: {
      autoCreateInvoice: boolean;
      approveTransaction: boolean;
    }
  ): Promise<ProcessMockWebhookResult> {
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

      if (!parsed.status) {
        const processed =
          await this.dependencies.paymentRepository.markWebhookProcessed(
            webhook.id,
            new Date().toISOString(),
            "התקבל אירוע שלא זוהה לסטטוס פנימי. נשמר payload גולמי לבדיקה."
          );

        return {
          outcome: "processed",
          payment,
          webhook: processed ?? webhook,
          duplicate: false,
          message: "האירוע נשמר לבדיקה, ללא שינוי סטטוס."
        };
      }

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
          message: "הסטטוס עודכן בהצלחה."
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
      let message = "הסטטוס עודכן בהצלחה.";
      let responsePayment = updatedPayment;

      if (updatedPayment.status === "paid" && behavior.autoCreateInvoice) {
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
              ? "הסטטוס עודכן בהצלחה. יצירת הקבלה המדומה נכשלה."
              : "הסטטוס עודכן בהצלחה. קבלה הופקה.";
        } catch (error) {
          message =
            error instanceof AppError
              ? `התשלום סומן כשולם, אך יצירת הקבלה נתקלה בשגיאה: ${error.message}`
              : "התשלום סומן כשולם, אך יצירת הקבלה נתקלה בשגיאה לא ידועה.";
        }
      }

      if (
        behavior.approveTransaction &&
        payment.provider === this.dependencies.paymentProvider.providerKey &&
        this.dependencies.paymentProvider.approveTransaction
      ) {
        try {
          await this.dependencies.paymentProvider.approveTransaction({
            payment: updatedPayment,
            eventType: parsed.eventType,
            providerEventId: parsed.eventId,
            rawPayload:
              "originalPayload" in parsed
                ? parsed.originalPayload
                : parsed.rawPayload
          });
        } catch (error) {
          const approvalMessage =
            "התשלום עודכן, אך קריאת Approve Transaction דרך Make נכשלה.";
          const processedWithNote =
            await this.dependencies.paymentRepository.markWebhookProcessed(
              webhook.id,
              new Date().toISOString(),
              approvalMessage
            );
          logger.error("provider_transaction_approval_failed", {
            paymentId: updatedPayment.id,
            provider: updatedPayment.provider,
            message: error instanceof Error ? error.message : "unknown_error"
          });

          return {
            outcome: "processed",
            payment: responsePayment,
            webhook: processedWithNote ?? processed ?? webhook,
            duplicate: false,
            message: `${message} ${approvalMessage}`,
            invoiceAttempt
          };
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

  private async findPaymentForWebhook(parsed: ParsedWebhook) {
    if ("internalPaymentId" in parsed && parsed.internalPaymentId) {
      const byInternalId = await this.dependencies.paymentRepository.findById(
        parsed.internalPaymentId
      );

      if (byInternalId) {
        return byInternalId;
      }
    }

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
