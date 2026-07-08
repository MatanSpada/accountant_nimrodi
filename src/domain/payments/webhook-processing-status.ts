export const WEBHOOK_PROCESSING_STATUSES = [
  "received",
  "processed",
  "failed"
] as const;

export type WebhookProcessingStatus =
  (typeof WEBHOOK_PROCESSING_STATUSES)[number];

export function isWebhookProcessingStatus(
  value: string
): value is WebhookProcessingStatus {
  return WEBHOOK_PROCESSING_STATUSES.includes(value as WebhookProcessingStatus);
}
