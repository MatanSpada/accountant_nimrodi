import type { WebhookProcessingStatus } from "./webhook-processing-status";

export interface PaymentWebhookRecord {
  id: string;
  paymentId: string | null;
  provider: string;
  providerEventId: string | null;
  providerTransactionId: string | null;
  eventType: string;
  rawPayload: string;
  receivedAt: string;
  processedAt: string | null;
  processingStatus: WebhookProcessingStatus;
  processingError: string | null;
}

export interface CreatePaymentWebhookInput {
  id: string;
  paymentId?: string | null;
  provider: string;
  providerEventId?: string | null;
  providerTransactionId?: string | null;
  eventType: string;
  rawPayload: string;
  receivedAt: string;
  processedAt?: string | null;
  processingStatus?: WebhookProcessingStatus;
  processingError?: string | null;
}
