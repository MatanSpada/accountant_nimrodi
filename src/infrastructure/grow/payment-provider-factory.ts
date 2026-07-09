import type { PaymentProvider } from "../../domain/payments/payment-provider";
import type { AppConfig } from "../../shared/config/app-config";
import { GrowPaymentProvider } from "./grow-payment-provider";
import { MockPaymentProvider } from "./mock-payment-provider";

export function createPaymentProvider(
  config: AppConfig,
  dependencies?: { fetchImpl?: typeof fetch }
): PaymentProvider {
  if (config.growMode === "mock") {
    return new MockPaymentProvider();
  }

  if (!config.growConfig) {
    throw new Error("Grow configuration is missing for non-mock mode.");
  }

  return new GrowPaymentProvider(config.growConfig, dependencies);
}
