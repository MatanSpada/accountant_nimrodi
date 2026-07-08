import { normalizeCustomerPhone } from "../../domain/payments/payment-validation";
import { formatAmountForMessage } from "./formatters";

function normalizePhoneForWaMe(phone: string) {
  const normalized = normalizeCustomerPhone(phone);

  if (!normalized) {
    return null;
  }

  return `972${normalized.slice(1)}`;
}

export function buildWhatsAppMessage(input: {
  customerName: string;
  description: string;
  amountAgorot: number;
  paymentUrl: string;
}) {
  return `שלום ${input.customerName}, מצורף קישור לתשלום עבור ${input.description} בסך ${formatAmountForMessage(input.amountAgorot)}: ${input.paymentUrl}`;
}

export function buildWhatsAppLink(input: {
  customerName: string;
  customerPhone: string | null;
  description: string;
  amountAgorot: number;
  paymentUrl: string | null;
}) {
  if (!input.customerPhone || !input.paymentUrl) {
    return null;
  }

  const phone = normalizePhoneForWaMe(input.customerPhone);

  if (!phone) {
    return null;
  }

  const message = buildWhatsAppMessage({
    customerName: input.customerName,
    description: input.description,
    amountAgorot: input.amountAgorot,
    paymentUrl: input.paymentUrl
  });

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
