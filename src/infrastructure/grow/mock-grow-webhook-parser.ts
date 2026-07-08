import { AppError } from "../../shared/errors/app-error";
import { normalizeCurrency } from "../../domain/payments/currency";
import { assertValidAmountAgorot } from "../../domain/payments/payment-validation";
import type { PaymentStatus } from "../../domain/payments/payment-status";

const MOCK_GROW_EVENT_STATUS_MAP = {
  "payment.paid": "paid",
  "payment.failed": "failed",
  "payment.cancelled": "cancelled",
  "payment.expired": "expired"
} as const satisfies Record<string, PaymentStatus>;

export type MockGrowWebhookEventType = keyof typeof MOCK_GROW_EVENT_STATUS_MAP;

export interface ParsedMockGrowWebhook {
  eventId: string;
  eventType: MockGrowWebhookEventType;
  provider: "mock-grow";
  providerPaymentId: string | null;
  providerTransactionId: string | null;
  status: PaymentStatus;
  amountAgorot: number;
  currency: ReturnType<typeof normalizeCurrency>;
  occurredAt: string;
  rawPayload: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeMockProvider(value: unknown) {
  if (typeof value !== "string") {
    throw new AppError("שדה provider חסר או לא תקין.", 400);
  }

  const normalized = value.trim().toLowerCase().replace(/_/g, "-");

  if (normalized !== "mock-grow") {
    throw new AppError("ה-endpoint הזה תומך רק ב-mock_grow לצורכי פיתוח.", 400);
  }

  return "mock-grow" as const;
}

function normalizeOccurredAt(value: unknown) {
  if (typeof value !== "string") {
    throw new AppError("שדה occurred_at חסר או לא תקין.", 400);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError("שדה occurred_at אינו תאריך ISO תקין.", 400);
  }

  return date.toISOString();
}

function normalizeEventType(value: unknown): MockGrowWebhookEventType {
  if (typeof value !== "string" || !(value in MOCK_GROW_EVENT_STATUS_MAP)) {
    throw new AppError("event_type אינו נתמך בסימולטור הפיתוח.", 400);
  }

  return value as MockGrowWebhookEventType;
}

function normalizeAmountAgorot(value: unknown) {
  const normalized =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  assertValidAmountAgorot(normalized);
  return normalized;
}

export function parseMockGrowWebhookPayload(
  payload: unknown
): ParsedMockGrowWebhook {
  if (!isRecord(payload)) {
    throw new AppError("גוף הבקשה חייב להיות אובייקט JSON תקין.", 400);
  }

  const eventId = payload.event_id;
  const eventType = normalizeEventType(payload.event_type);
  const provider = normalizeMockProvider(payload.provider);
  const providerPaymentId = payload.provider_payment_id;
  const providerTransactionId = payload.provider_transaction_id;
  const status = payload.status;

  if (typeof eventId !== "string" || !eventId.trim()) {
    throw new AppError("שדה event_id חסר או ריק.", 400);
  }

  if (typeof status !== "string" || !status.trim()) {
    throw new AppError("שדה status חסר או ריק.", 400);
  }

  const expectedStatus = MOCK_GROW_EVENT_STATUS_MAP[eventType];
  if (status.trim().toLowerCase() !== expectedStatus) {
    throw new AppError(
      "status חייב להתאים ל-event_type בסימולטור הפיתוח.",
      400
    );
  }

  if (
    typeof providerPaymentId !== "string" &&
    typeof providerTransactionId !== "string"
  ) {
    throw new AppError(
      "נדרש לפחות אחד מהמזהים provider_payment_id או provider_transaction_id.",
      400
    );
  }

  return {
    eventId: eventId.trim(),
    eventType,
    provider,
    providerPaymentId:
      typeof providerPaymentId === "string" && providerPaymentId.trim()
        ? providerPaymentId.trim()
        : null,
    providerTransactionId:
      typeof providerTransactionId === "string" && providerTransactionId.trim()
        ? providerTransactionId.trim()
        : null,
    status: expectedStatus,
    amountAgorot: normalizeAmountAgorot(payload.amount_agorot),
    currency: normalizeCurrency(String(payload.currency ?? "")),
    occurredAt: normalizeOccurredAt(payload.occurred_at),
    rawPayload: JSON.stringify(payload)
  };
}
