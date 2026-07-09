import type {
  PaymentProvider,
  ProviderPaymentRequest,
  ProviderPaymentStatusResult
} from "../../domain/payments/payment-provider";
import type { CreatePaymentDraftInput } from "../../domain/payments/payment-types";
import type { GrowProviderConfig } from "../../shared/config/app-config";
import { AppError } from "../../shared/errors/app-error";
import {
  GROW_CREATE_PAYMENT_PROCESS_ASSUMPTIONS,
  mapToGrowCreatePaymentProcessRequest
} from "./grow-request-mapper";

interface GrowPaymentProviderDependencies {
  fetchImpl?: typeof fetch;
}

interface GrowResponseCandidate extends Record<string, unknown> {
  paymentUrl?: unknown;
  payment_url?: unknown;
  url?: unknown;
  redirectUrl?: unknown;
  redirect_url?: unknown;
  paymentProcessUrl?: unknown;
  paymentProcessURL?: unknown;
  providerPaymentId?: unknown;
  paymentId?: unknown;
  id?: unknown;
  processId?: unknown;
  transactionId?: unknown;
  providerTransactionId?: unknown;
  transaction_id?: unknown;
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

export class GrowPaymentProvider implements PaymentProvider {
  readonly providerKey = "grow";

  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly config: GrowProviderConfig,
    dependencies: GrowPaymentProviderDependencies = {}
  ) {
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
  }

  async createPaymentRequest(
    input: CreatePaymentDraftInput & { internalPaymentId: string }
  ): Promise<ProviderPaymentRequest> {
    const payload = mapToGrowCreatePaymentProcessRequest({
      ...input,
      growConfig: this.config
    });
    const endpoint = new URL(
      "createPaymentProcess",
      this.normalizeBaseUrl()
    ).toString();
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };

    if (this.config.apiKey) {
      headers.authorization = `Bearer ${this.config.apiKey}`;
    }

    let response: Response;

    try {
      response = await this.fetchImpl(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
    } catch {
      throw new AppError(
        `קריאת createPaymentProcess ל-GROW ${this.config.mode} נכשלה. יש לאמת endpoint, רשת ופרטי sandbox/production.`,
        502
      );
    }

    const responseText = await response.text();

    if (!response.ok) {
      throw new AppError(
        `GROW createPaymentProcess החזיר ${response.status}. יש לאמת endpoint, credentials ופרטי החשבון.`,
        502
      );
    }

    let parsedResponse: GrowResponseCandidate;
    try {
      parsedResponse = JSON.parse(responseText) as GrowResponseCandidate;
    } catch {
      throw new AppError(
        "GROW החזיר תגובה שאינה JSON תקין. יש לאמת את endpoint וה-response format בחשבון הלקוח.",
        502
      );
    }

    const paymentUrl = pickString(parsedResponse, [
      "paymentUrl",
      "payment_url",
      "url",
      "redirectUrl",
      "redirect_url",
      "paymentProcessUrl",
      "paymentProcessURL"
    ]);
    const providerPaymentId = pickString(parsedResponse, [
      "providerPaymentId",
      "paymentId",
      "id",
      "processId"
    ]);
    const providerTransactionId = pickString(parsedResponse, [
      "providerTransactionId",
      "transactionId",
      "transaction_id"
    ]);

    if (!paymentUrl || !providerPaymentId) {
      throw new AppError(
        "GROW createPaymentProcess לא החזיר payment URL או provider payment id בפורמט מאומת. יש לאמת את שדות התגובה מול sandbox אמיתי.",
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
        mode: this.config.mode,
        assumedEndpoint: endpoint,
        reference: input.internalPaymentId,
        assumption1: GROW_CREATE_PAYMENT_PROCESS_ASSUMPTIONS[0],
        assumption2: GROW_CREATE_PAYMENT_PROCESS_ASSUMPTIONS[1],
        bankTransferOnly:
          this.config.bankTransferOnlyStatus === "requested_unverified"
            ? "Requested but not sent because field is unverified."
            : "Not requested."
      }
    };
  }

  async getPaymentStatus(
    providerPaymentId: string
  ): Promise<ProviderPaymentStatusResult> {
    throw new AppError(
      `GROW getPaymentStatus עדיין לא מומש עבור ${providerPaymentId}. יש לאמת קודם את endpoint והשדות בחשבון הלקוח.`,
      501
    );
  }

  private normalizeBaseUrl() {
    return this.config.apiBaseUrl.endsWith("/")
      ? this.config.apiBaseUrl
      : `${this.config.apiBaseUrl}/`;
  }
}
