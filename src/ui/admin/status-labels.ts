import type { PaymentStatus } from "../../domain/payments/payment-status";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  draft: "טיוטה",
  payment_created: "קישור נוצר",
  pending: "ממתין לתשלום",
  paid: "שולם",
  failed: "נכשל",
  cancelled: "בוטל",
  expired: "פג תוקף"
};

export function getPaymentStatusLabel(status: PaymentStatus) {
  return PAYMENT_STATUS_LABELS[status];
}
