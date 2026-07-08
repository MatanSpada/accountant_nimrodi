export const PAYMENT_STATUSES = [
  "draft",
  "payment_created",
  "pending",
  "paid",
  "failed",
  "cancelled",
  "expired"
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const FINAL_PAYMENT_STATUSES = new Set<PaymentStatus>([
  "paid",
  "failed",
  "cancelled",
  "expired"
]);

const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  draft: ["payment_created", "pending", "failed", "cancelled"],
  payment_created: ["pending", "paid", "failed", "cancelled", "expired"],
  pending: ["paid", "failed", "cancelled", "expired"],
  paid: [],
  failed: [],
  cancelled: [],
  expired: []
};

export function isPaymentStatus(value: string): value is PaymentStatus {
  return PAYMENT_STATUSES.includes(value as PaymentStatus);
}

export function isFinalPaymentStatus(status: PaymentStatus) {
  return FINAL_PAYMENT_STATUSES.has(status);
}

export function canTransitionPaymentStatus(
  from: PaymentStatus,
  to: PaymentStatus
) {
  return from === to || PAYMENT_STATUS_TRANSITIONS[from].includes(to);
}
