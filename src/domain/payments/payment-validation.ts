import { AppError } from "../../shared/errors/app-error";
import type { CreatePaymentRequestInput } from "./payment-types";

export function assertAgorotAmount(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new AppError("amountAgorot חייב להיות מספר שלם וחיובי באגורות.", 400);
  }
}

export function validateCreatePaymentRequestInput(
  input: CreatePaymentRequestInput
): CreatePaymentRequestInput {
  if (!input.customerName?.trim()) {
    throw new AppError("שם לקוח הוא שדה חובה.", 400);
  }

  if (!input.description?.trim()) {
    throw new AppError("תיאור הוא שדה חובה.", 400);
  }

  assertAgorotAmount(input.amountAgorot);

  return {
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone?.trim() || null,
    customerEmail: input.customerEmail?.trim().toLowerCase() || null,
    amountAgorot: input.amountAgorot,
    currency: input.currency.trim().toUpperCase(),
    description: input.description.trim()
  };
}
