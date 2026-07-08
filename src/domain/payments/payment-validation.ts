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
