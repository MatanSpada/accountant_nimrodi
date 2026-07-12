import { normalizeCurrency } from "../../domain/payments/currency";
import {
  isPaymentStatus,
  type PaymentStatus
} from "../../domain/payments/payment-status";
import { AppError } from "../../shared/errors/app-error";

export interface ParsedMakeGrowWebhook {
  eventId: string;
  eventType: string;
  provider: "make-grow";
  internalPaymentId: string | null;
  providerPaymentId: string | null;
  providerTransactionId: string | null;
  status: PaymentStatus | null;
  amountAgorot: number | null;
  currency: ReturnType<typeof normalizeCurrency> | null;
  occurredAt: string;
  rawPayload: string;
  originalPayload: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(
  record: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = key.includes(".")
      ? key.split(".").reduce<unknown>((current, part) => {
          if (
            !current ||
            typeof current !== "object" ||
            Array.isArray(current)
          ) {
            return undefined;
          }

          return (current as Record<string, unknown>)[part];
        }, record)
      : record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function readBoolean(
  record: Record<string, unknown>,
  ...keys: string[]
): boolean | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return null;
}

function normalizeOccurredAt(payload: Record<string, unknown>) {
  const candidate =
    readString(
      payload,
      "occurred_at",
      "occurredAt",
      "created_at",
      "createdAt"
    ) ?? new Date().toISOString();
  const parsed = new Date(candidate);

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError("שדה זמן האירוע אינו בפורמט תקין.", 400);
  }

  return parsed.toISOString();
}

function parseNumericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/,/g, "").trim())
        : Number.NaN;

  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return numeric;
}

function mapExternalStatus(
  payload: Record<string, unknown>
): PaymentStatus | null {
  const rawStatus =
    readString(
      payload,
      "status",
      "payment_status",
      "paymentStatus",
      "result"
    ) ?? "";
  const normalized = rawStatus.toLowerCase();

  const explicit: Record<string, PaymentStatus> = {
    paid: "paid",
    success: "paid",
    approved: "paid",
    completed: "paid",
    failed: "failed",
    failure: "failed",
    error: "failed",
    declined: "failed",
    canceled: "cancelled",
    cancelled: "cancelled",
    expired: "expired"
  };

  if (normalized && normalized in explicit) {
    return explicit[normalized];
  }

  if (normalized && isPaymentStatus(normalized)) {
    return normalized;
  }

  const success = readBoolean(payload, "success");
  if (success === true) {
    return "paid";
  }
  if (success === false) {
    return "failed";
  }

  return null;
}

function deriveEventId(
  payload: Record<string, unknown>,
  mappedStatus: PaymentStatus | null
) {
  const explicit = readString(
    payload,
    "event_id",
    "eventId",
    "provider_event_id",
    "providerEventId",
    "notificationId"
  );

  if (explicit) {
    return explicit;
  }

  const internalPaymentId = readString(
    payload,
    "metadata.payment_id",
    "customData.payment_id",
    "customData.paymentId",
    "payment_id",
    "paymentId"
  );
  const providerPaymentId = readString(
    payload,
    "paymentLinkProcessId",
    "payment_link_process_id",
    "providerPaymentId",
    "provider_payment_id"
  );
  const providerTransactionId = readString(
    payload,
    "transactionId",
    "transaction_id"
  );
  const occurredAt = readString(
    payload,
    "occurred_at",
    "occurredAt",
    "created_at",
    "createdAt"
  );

  return [
    "derived",
    internalPaymentId ?? "no-payment",
    providerPaymentId ?? "no-provider-payment",
    providerTransactionId ?? "no-transaction",
    mappedStatus ?? "unknown",
    occurredAt ?? "no-time"
  ].join(":");
}

export function parseMakeGrowWebhookPayload(
  payload: unknown
): ParsedMakeGrowWebhook {
  if (!isRecord(payload)) {
    throw new AppError("גוף ה-webhook חייב להיות אובייקט JSON תקין.", 400);
  }

  const status = mapExternalStatus(payload);
  const internalPaymentId = readString(
    payload,
    "metadata.payment_id",
    "customData.payment_id",
    "customData.paymentId",
    "payment_id",
    "paymentId"
  );
  const providerPaymentId = readString(
    payload,
    "paymentLinkProcessId",
    "payment_link_process_id",
    "payment_link_processId",
    "providerPaymentId",
    "provider_payment_id"
  );
  const providerTransactionId = readString(
    payload,
    "transactionId",
    "transaction_id"
  );

  if (!internalPaymentId && !providerPaymentId && !providerTransactionId) {
    throw new AppError(
      "לא נמצא מזהה פנימי או מזהה ספק ב-webhook של Make/GROW.",
      400
    );
  }

  const amountAgorotExplicit = parseNumericValue(
    payload.amount_agorot ?? payload.amountAgorot ?? null
  );
  const amountIls = parseNumericValue(payload.amount ?? payload.sum ?? null);
  const currencyRaw = readString(payload, "currency");
  const normalizedStatus = status;

  return {
    eventId: deriveEventId(payload, normalizedStatus),
    eventType: normalizedStatus
      ? `payment.${normalizedStatus}`
      : "payment.unknown",
    provider: "make-grow",
    internalPaymentId,
    providerPaymentId,
    providerTransactionId,
    status: normalizedStatus,
    amountAgorot:
      amountAgorotExplicit !== null
        ? amountAgorotExplicit
        : amountIls !== null
          ? Math.round(amountIls * 100)
          : null,
    currency: currencyRaw ? normalizeCurrency(currencyRaw) : null,
    occurredAt: normalizeOccurredAt(payload),
    rawPayload: JSON.stringify(payload),
    originalPayload: payload
  };
}
