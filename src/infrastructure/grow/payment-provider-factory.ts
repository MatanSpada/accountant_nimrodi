import type { PaymentProvider } from "../../domain/payments/payment-provider";
import type { CreatePaymentDraftInput } from "../../domain/payments/payment-types";
import type {
  ProviderPaymentRequest,
  ProviderPaymentStatusResult
} from "../../domain/payments/payment-provider";
import type { AppConfig } from "../../shared/config/app-config";
import { AppError } from "../../shared/errors/app-error";
import { GrowPaymentProvider } from "./grow-payment-provider";
import { MakeGrowPaymentProvider } from "./make-grow-payment-provider";
import { MockPaymentProvider } from "./mock-payment-provider";

class UnavailablePaymentProvider implements PaymentProvider {
  readonly providerKey: string;

  constructor(
    providerKey: string,
    private readonly message: string
  ) {
    this.providerKey = providerKey;
  }

  assertReady() {
    throw new AppError(this.message, 500);
  }

  async createPaymentRequest(
    _input: CreatePaymentDraftInput & { internalPaymentId: string }
  ): Promise<ProviderPaymentRequest> {
    void _input;
    throw new AppError(this.message, 500);
  }

  async getPaymentStatus(
    _providerPaymentId: string
  ): Promise<ProviderPaymentStatusResult> {
    void _providerPaymentId;
    throw new AppError(this.message, 500);
  }
}

export function createPaymentProvider(
  config: AppConfig,
  dependencies?: { fetchImpl?: typeof fetch }
): PaymentProvider {
  if (config.defaultPaymentProvider === "mock-grow") {
    return new MockPaymentProvider();
  }

  if (config.defaultPaymentProvider === "make-grow") {
    if (!config.makeGrowConfig) {
      return new UnavailablePaymentProvider(
        "make-grow",
        "חיבור Make לא מוגדר — חסרה כתובת webhook ליצירת קישור תשלום."
      );
    }

    return new MakeGrowPaymentProvider(config.makeGrowConfig, dependencies);
  }

  if (!config.growConfig) {
    return new UnavailablePaymentProvider(
      "grow",
      "תצורת GROW הישירה חסרה. יש לאמת sandbox/production או לבחור ספק אחר."
    );
  }

  return new GrowPaymentProvider(config.growConfig, dependencies);
}
