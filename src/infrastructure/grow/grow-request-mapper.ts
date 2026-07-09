import type { CreatePaymentDraftInput } from "../../domain/payments/payment-types";
import type { GrowProviderConfig } from "../../shared/config/app-config";

export interface GrowCreatePaymentProcessRequest {
  userId: string;
  pageCode: string;
  amount: string;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  invoiceNotifyUrl?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  reference: string;
}

export interface GrowCreatePaymentProcessMappingInput extends CreatePaymentDraftInput {
  internalPaymentId: string;
  growConfig: GrowProviderConfig;
}

function formatGrowAmount(amountAgorot: number) {
  return (amountAgorot / 100).toFixed(2);
}

export function mapToGrowCreatePaymentProcessRequest(
  input: GrowCreatePaymentProcessMappingInput
): GrowCreatePaymentProcessRequest {
  return {
    userId: input.growConfig.userId,
    pageCode: input.growConfig.pageCode,
    amount: formatGrowAmount(input.amountAgorot),
    currency: input.currency,
    description: input.description,
    successUrl: input.growConfig.successUrl,
    cancelUrl: input.growConfig.cancelUrl,
    notifyUrl: input.growConfig.notifyUrl,
    ...(input.growConfig.invoiceNotifyUrl
      ? { invoiceNotifyUrl: input.growConfig.invoiceNotifyUrl }
      : {}),
    ...(input.customerName ? { customerName: input.customerName } : {}),
    ...(input.customerPhone ? { customerPhone: input.customerPhone } : {}),
    ...(input.customerEmail ? { customerEmail: input.customerEmail } : {}),
    reference: input.internalPaymentId
  };
}

export const GROW_CREATE_PAYMENT_PROCESS_ASSUMPTIONS = [
  "The field names in this mapper are working assumptions only.",
  "They must be verified against the client's real GROW sandbox account before production use.",
  "No bank-transfer-only field is sent yet because that part of the API is still unverified."
] as const;
