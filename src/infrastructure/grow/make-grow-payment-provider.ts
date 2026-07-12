import type {
  PaymentProvider,
  ProviderPaymentRequest,
  ProviderPaymentStatusResult,
  ProviderTransactionApprovalInput
} from "../../domain/payments/payment-provider";
import type { CreatePaymentDraftInput } from "../../domain/payments/payment-types";
import type { MakeGrowProviderConfig } from "../../shared/config/app-config";
import { AppError } from "../../shared/errors/app-error";
import { logger } from "../../shared/logger/logger";

interface MakeGrowPaymentProviderDependencies {
  fetchImpl?: typeof fetch;
}

interface MakeGrowResponseCandidate extends Record<string, unknown> {
  payment_url?: unknown;
  paymentUrl?: unknown;
  url?: unknown;
  link?: unknown;
  paymentLink?: unknown;
  provider_payment_id?: unknown;
  providerPaymentId?: unknown;
  payment_link_process_id?: unknown;
  paymentLinkProcessId?: unknown;
  payment_link_processId?: unknown;
  transaction_id?: unknown;
  transactionId?: unknown;
  raw?: unknown;
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function buildNotifyUrl(publicBaseUrl: string) {
  return `${publicBaseUrl}/api/grow/webhook`;
}

function formatAmountIls(amountAgorot: number) {
  return Number((amountAgorot / 100).toFixed(2));
}

export class MakeGrowPaymentProvider implements PaymentProvider {
  readonly providerKey = "make-grow";

  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly config: MakeGrowProviderConfig,
    dependencies: MakeGrowPaymentProviderDependencies = {}
  ) {
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
  }

  async createPaymentRequest(
    input: CreatePaymentDraftInput & { internalPaymentId: string }
  ): Promise<ProviderPaymentRequest> {
    const payload = {
      payment_id: input.internalPaymentId,
      customer_name: input.customerName,
      customer_email: input.customerEmail ?? null,
      customer_phone: input.customerPhone ?? null,
      amount_agorot: input.amountAgorot,
      amount_ils: formatAmountIls(input.amountAgorot),
      currency: input.currency,
      description: input.description,
      send_method: "none",
      allowed_payment_methods: ["bank_transfer"],
      notify_url: buildNotifyUrl(this.config.publicBaseUrl),
      metadata: {
        source: "accountant_nimrodi",
        payment_id: input.internalPaymentId
      }
    };

    const response = await this.postJson(
      this.config.createPaymentLinkWebhookUrl,
      payload,
      this.config.createPaymentLinkSecret,
      "create-payment-link"
    );

    const paymentUrl = pickString(response, [
      "payment_url",
      "paymentUrl",
      "url",
      "link",
      "paymentLink"
    ]);
    const providerPaymentId = pickString(response, [
      "provider_payment_id",
      "providerPaymentId",
      "payment_link_process_id",
      "paymentLinkProcessId",
      "payment_link_processId"
    ]);
    const providerTransactionId = pickString(response, [
      "transaction_id",
      "transactionId"
    ]);

    if (!paymentUrl) {
      throw new AppError(
        "חיבור Make לא החזיר קישור תשלום. יש לאמת את ה-scenario ואת תגובת ה-webhook של Make.",
        502
      );
    }

    if (!providerPaymentId) {
      throw new AppError(
        "חיבור Make לא החזיר מזהה תשלום של GROW. יש לאמת את מיפוי השדות בתרחיש Make.",
        502
      );
    }

    return {
      provider: this.providerKey,
      providerPaymentId,
      providerTransactionId,
      paymentUrl,
      status: "payment_created",
      rawReference: {
        mode: "make-grow",
        notifyUrl: payload.notify_url,
        sendMethod: payload.send_method,
        allowedPaymentMethods: payload.allowed_payment_methods.join(","),
        makeResponseKeys: Object.keys(response).join(",")
      }
    };
  }

  async getPaymentStatus(
    providerPaymentId: string
  ): Promise<ProviderPaymentStatusResult> {
    throw new AppError(
      `בדיקת סטטוס מול Make/GROW עדיין לא מומשה עבור ${providerPaymentId}.`,
      501
    );
  }

  async approveTransaction(
    input: ProviderTransactionApprovalInput
  ): Promise<void> {
    if (!this.config.approveTransactionWebhookUrl) {
      return;
    }

    await this.postJson(
      this.config.approveTransactionWebhookUrl,
      {
        payment_id: input.payment.id,
        provider_payment_id: input.payment.providerPaymentId,
        provider_transaction_id: input.payment.providerTransactionId,
        event_type: input.eventType,
        provider_event_id: input.providerEventId,
        original_notification: input.rawPayload
      },
      this.config.approveTransactionSecret,
      "approve-transaction"
    ).catch((error) => {
      logger.error("make_grow_approve_transaction_failed", {
        paymentId: input.payment.id,
        providerPaymentId: input.payment.providerPaymentId,
        message: error instanceof Error ? error.message : "unknown_error"
      });

      throw error;
    });
  }

  private async postJson(
    url: string,
    payload: Record<string, unknown>,
    secret: string | null,
    action: "create-payment-link" | "approve-transaction"
  ) {
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };

    if (secret) {
      headers["x-make-shared-secret"] = secret;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
    } catch {
      throw new AppError(
        `קריאת Make עבור ${action} נכשלה. יש לאמת את כתובת ה-webhook, הרשת וה-scenario.`,
        502
      );
    }

    const responseText = await response.text();

    if (!response.ok) {
      throw new AppError(
        `Make החזיר ${response.status} עבור ${action}. יש לאמת את ה-scenario והגדרות החיבור.`,
        502
      );
    }

    try {
      return JSON.parse(responseText) as MakeGrowResponseCandidate;
    } catch {
      throw new AppError(
        `Make החזיר תגובה שאינה JSON תקין עבור ${action}.`,
        502
      );
    }
  }
}
