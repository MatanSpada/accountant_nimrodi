import { AppError } from "../../shared/errors/app-error";
import {
  canTransitionPaymentStatus,
  isFinalPaymentStatus,
  type PaymentStatus
} from "./payment-status";
import type { Payment } from "./payment-types";

interface ParsedPaymentWebhookForValidation {
  providerPaymentId: string | null;
  providerTransactionId: string | null;
  amountAgorot: number | null;
  currency: Payment["currency"] | null;
}

export function assertWebhookPaymentMatch(
  payment: Payment,
  webhook: ParsedPaymentWebhookForValidation
) {
  if (
    webhook.providerPaymentId &&
    payment.providerPaymentId &&
    payment.providerPaymentId !== webhook.providerPaymentId
  ) {
    throw new AppError("provider_payment_id אינו תואם לתשלום שנמצא.", 422);
  }

  if (
    webhook.providerTransactionId &&
    payment.providerTransactionId &&
    payment.providerTransactionId !== webhook.providerTransactionId
  ) {
    throw new AppError("provider_transaction_id אינו תואם לתשלום שנמצא.", 422);
  }

  if (
    webhook.amountAgorot !== null &&
    payment.amountAgorot !== webhook.amountAgorot
  ) {
    throw new AppError("סכום ה-webhook אינו תואם לתשלום.", 422);
  }

  if (webhook.currency !== null && payment.currency !== webhook.currency) {
    throw new AppError("מטבע ה-webhook אינו תואם לתשלום.", 422);
  }
}

export function assertWebhookStatusTransition(
  currentStatus: PaymentStatus,
  nextStatus: PaymentStatus
) {
  if (!canTransitionPaymentStatus(currentStatus, nextStatus)) {
    throw new AppError(
      `לא ניתן לעבור מסטטוס ${currentStatus} לסטטוס ${nextStatus}.`,
      422
    );
  }
}

export function isIdempotentFinalStatusMatch(
  currentStatus: PaymentStatus,
  nextStatus: PaymentStatus
) {
  return isFinalPaymentStatus(currentStatus) && currentStatus === nextStatus;
}
