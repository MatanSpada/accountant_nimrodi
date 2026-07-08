import { AppError } from "../../shared/errors/app-error";
import { normalizeCurrency } from "./currency";
import type {
  CreatePaymentDraftInput,
  CreatePaymentRequestInput
} from "./payment-types";

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function assertValidAmountAgorot(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new AppError("amountAgorot חייב להיות מספר שלם וחיובי באגורות.", 400);
  }

  if (!Number.isSafeInteger(value)) {
    throw new AppError("amountAgorot חייב להיות מספר שלם בטווח בטוח.", 400);
  }
}

export function normalizeCustomerPhone(value?: string | null) {
  if (!value?.trim()) {
    return null;
  }

  const compact = value.replace(/[^\d+]/g, "");
  const normalized = compact.startsWith("+972")
    ? `0${compact.slice(4)}`
    : compact.startsWith("972")
      ? `0${compact.slice(3)}`
      : compact;

  if (!/^0\d{8,9}$/.test(normalized)) {
    throw new AppError("מספר טלפון אינו תקין.", 400);
  }

  return normalized;
}

export function normalizeCustomerEmail(value?: string | null) {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (!BASIC_EMAIL_REGEX.test(normalized)) {
    throw new AppError("כתובת אימייל אינה תקינה.", 400);
  }

  return normalized;
}

export function validateCreatePaymentDraftInput(
  input: CreatePaymentRequestInput
): CreatePaymentDraftInput {
  if (!input.customerName?.trim()) {
    throw new AppError("שם לקוח הוא שדה חובה.", 400);
  }

  if (!input.description?.trim()) {
    throw new AppError("תיאור הוא שדה חובה.", 400);
  }

  assertValidAmountAgorot(input.amountAgorot);

  return {
    customerName: input.customerName.trim(),
    customerPhone: normalizeCustomerPhone(input.customerPhone),
    customerEmail: normalizeCustomerEmail(input.customerEmail),
    amountAgorot: input.amountAgorot,
    currency: normalizeCurrency(input.currency),
    description: input.description.trim(),
    externalCrmDealId: input.externalCrmDealId?.trim() || null
  };
}

function readStringField(
  payload: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}

function convertAmountShekelToAgorot(value: string | number) {
  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(value.trim());

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new AppError("amount_shekel חייב להיות מספר חיובי.", 400);
  }

  return Math.round(numericValue * 100);
}

export function normalizeCreatePaymentApiInput(
  rawInput: unknown
): CreatePaymentRequestInput {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new AppError("גוף הבקשה חייב להיות אובייקט JSON תקין.", 400);
  }

  const payload = rawInput as Record<string, unknown>;
  const amountAgorotValue = payload.amountAgorot ?? payload.amount_agorot;
  const amountShekelValue = payload.amountShekel ?? payload.amount_shekel;

  let amountAgorot: number;

  if (typeof amountAgorotValue === "number") {
    amountAgorot = amountAgorotValue;
  } else if (
    typeof amountAgorotValue === "string" &&
    amountAgorotValue.trim()
  ) {
    amountAgorot = Number.parseInt(amountAgorotValue.trim(), 10);
  } else if (
    typeof amountShekelValue === "number" ||
    (typeof amountShekelValue === "string" && amountShekelValue.trim())
  ) {
    amountAgorot = convertAmountShekelToAgorot(
      amountShekelValue as string | number
    );
  } else {
    throw new AppError("יש לספק amount_agorot או amount_shekel.", 400);
  }

  return {
    customerName:
      readStringField(payload, "customerName", "customer_name") ?? "",
    customerPhone:
      readStringField(payload, "customerPhone", "customer_phone") ?? null,
    customerEmail:
      readStringField(payload, "customerEmail", "customer_email") ?? null,
    amountAgorot,
    currency: readStringField(payload, "currency") ?? "ILS",
    description: readStringField(payload, "description") ?? "",
    externalCrmDealId:
      readStringField(payload, "externalCrmDealId", "external_crm_deal_id") ??
      null
  };
}

export function convertAmountShekelToAgorotForTesting(value: string | number) {
  return convertAmountShekelToAgorot(value);
}
