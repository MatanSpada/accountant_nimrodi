export const PAYMENT_STATUSES = [
  "draft",
  "pending",
  "paid",
  "failed",
  "cancelled"
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export function isPaymentStatus(value: string): value is PaymentStatus {
  return PAYMENT_STATUSES.includes(value as PaymentStatus);
}
