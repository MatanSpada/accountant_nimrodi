import { describe, expect, it } from "vitest";

import { createPaymentProvider } from "../src/infrastructure/grow/payment-provider-factory";
import { GrowPaymentProvider } from "../src/infrastructure/grow/grow-payment-provider";
import { MockPaymentProvider } from "../src/infrastructure/grow/mock-payment-provider";
import { getAppConfig } from "../src/shared/config/app-config";

describe("payment provider factory", () => {
  it("selects MockPaymentProvider in mock mode", () => {
    const config = getAppConfig({
      APP_ENV: "development",
      GROW_MODE: "mock",
      INVOICE_MODE: "mock",
      ENABLE_DEV_TOOLS: "true"
    });

    const provider = createPaymentProvider(config);

    expect(provider).toBeInstanceOf(MockPaymentProvider);
  });

  it("selects GrowPaymentProvider in sandbox mode when config is valid", () => {
    const config = getAppConfig({
      APP_ENV: "staging",
      ADMIN_PASSWORD: "staging-password",
      SESSION_SECRET: "staging-secret",
      GROW_MODE: "sandbox",
      GROW_USER_ID: "user-123",
      GROW_PAGE_CODE: "page-123",
      GROW_API_BASE_URL: "https://sandbox.grow.example/api",
      GROW_SUCCESS_URL: "https://payments.example/success",
      GROW_CANCEL_URL: "https://payments.example/cancel",
      GROW_NOTIFY_URL: "https://payments.example/webhooks/grow",
      INVOICE_MODE: "mock",
      ENABLE_DEV_TOOLS: "false"
    });

    const provider = createPaymentProvider(config);

    expect(provider).toBeInstanceOf(GrowPaymentProvider);
  });

  it("selects GrowPaymentProvider in production mode when config is valid", () => {
    const config = getAppConfig({
      APP_ENV: "production",
      ADMIN_PASSWORD: "prod-password",
      SESSION_SECRET: "prod-secret",
      GROW_MODE: "production",
      GROW_USER_ID: "user-123",
      GROW_PAGE_CODE: "page-123",
      GROW_API_BASE_URL: "https://grow.example/api",
      GROW_SUCCESS_URL: "https://payments.example/success",
      GROW_CANCEL_URL: "https://payments.example/cancel",
      GROW_NOTIFY_URL: "https://payments.example/webhooks/grow",
      INVOICE_MODE: "mock",
      ENABLE_DEV_TOOLS: "false"
    });

    const provider = createPaymentProvider(config);

    expect(provider).toBeInstanceOf(GrowPaymentProvider);
  });
});
