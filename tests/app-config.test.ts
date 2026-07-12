import { describe, expect, it } from "vitest";

import { getAppConfig } from "../src/shared/config/app-config";

describe("app config", () => {
  it("works in mock mode without Grow credentials", () => {
    const config = getAppConfig({
      APP_ENV: "development",
      GROW_MODE: "mock",
      INVOICE_MODE: "mock",
      ENABLE_DEV_TOOLS: "true"
    });

    expect(config.growMode).toBe("mock");
    expect(config.growConfig).toBeNull();
    expect(config.growStatus.hasRequiredConfig).toBe(false);
  });

  it("fails in sandbox mode when required Grow config is missing", () => {
    expect(() =>
      getAppConfig({
        APP_ENV: "staging",
        ADMIN_PASSWORD: "staging-password",
        SESSION_SECRET: "staging-secret",
        GROW_MODE: "sandbox",
        INVOICE_MODE: "mock",
        ENABLE_DEV_TOOLS: "false"
      })
    ).toThrow("GROW_USER_ID");
  });

  it("fails in production mode when required Grow config is missing", () => {
    expect(() =>
      getAppConfig({
        APP_ENV: "production",
        ADMIN_PASSWORD: "prod-password",
        SESSION_SECRET: "prod-secret",
        GROW_MODE: "production",
        INVOICE_MODE: "mock",
        ENABLE_DEV_TOOLS: "false"
      })
    ).toThrow("GROW_USER_ID");
  });

  it("fails in production when ADMIN_PASSWORD is missing", () => {
    expect(() =>
      getAppConfig({
        APP_ENV: "production",
        SESSION_SECRET: "prod-secret",
        GROW_MODE: "mock",
        INVOICE_MODE: "mock",
        ENABLE_DEV_TOOLS: "false",
        ALLOW_MOCK_GROW_IN_PRODUCTION: "true"
      })
    ).toThrow("ADMIN_PASSWORD");
  });

  it("fails in production when SESSION_SECRET is missing", () => {
    expect(() =>
      getAppConfig({
        APP_ENV: "production",
        ADMIN_PASSWORD: "prod-password",
        GROW_MODE: "mock",
        INVOICE_MODE: "mock",
        ENABLE_DEV_TOOLS: "false",
        ALLOW_MOCK_GROW_IN_PRODUCTION: "true"
      })
    ).toThrow("SESSION_SECRET");
  });

  it("allows documented development defaults", () => {
    const config = getAppConfig({
      APP_ENV: "development",
      GROW_MODE: "mock",
      INVOICE_MODE: "mock",
      ENABLE_DEV_TOOLS: "true"
    });

    expect(config.adminPassword).toBe("dev-admin-password");
    expect(config.sessionSecret).toBe("dev-session-secret-change-me");
    expect(config.enableDevTools).toBe(true);
  });

  it("rejects production with ENABLE_DEV_TOOLS=true", () => {
    expect(() =>
      getAppConfig({
        APP_ENV: "production",
        ADMIN_PASSWORD: "prod-password",
        SESSION_SECRET: "prod-secret",
        GROW_MODE: "mock",
        INVOICE_MODE: "mock",
        ENABLE_DEV_TOOLS: "true",
        ALLOW_MOCK_GROW_IN_PRODUCTION: "true"
      })
    ).toThrow("ENABLE_DEV_TOOLS=true");
  });

  it("does not include secret values in safe config errors", () => {
    try {
      getAppConfig({
        APP_ENV: "production",
        ADMIN_PASSWORD: "prod-password",
        SESSION_SECRET: "prod-secret",
        GROW_MODE: "production",
        GROW_API_KEY: "super-secret-grow-key",
        INVOICE_MODE: "mock",
        ENABLE_DEV_TOOLS: "false"
      });
      throw new Error("Expected getAppConfig to fail");
    } catch (error) {
      expect(String(error)).toContain("GROW_USER_ID");
      expect(String(error)).not.toContain("super-secret-grow-key");
    }
  });

  it("keeps make-grow selectable without crashing when config is incomplete", () => {
    const config = getAppConfig({
      APP_ENV: "staging",
      ADMIN_PASSWORD: "staging-password",
      SESSION_SECRET: "staging-secret",
      DEFAULT_PAYMENT_PROVIDER: "make-grow",
      GROW_MODE: "mock",
      INVOICE_MODE: "mock",
      ENABLE_DEV_TOOLS: "false"
    });

    expect(config.defaultPaymentProvider).toBe("make-grow");
    expect(config.makeGrowConfig).toBeNull();
    expect(config.makeGrowStatus.hasRequiredConfig).toBe(false);
    expect(config.makeGrowStatus.missingFields).toContain(
      "MAKE_CREATE_PAYMENT_LINK_WEBHOOK_URL"
    );
  });

  it("builds make-grow config when required webhook values exist", () => {
    const config = getAppConfig({
      APP_ENV: "staging",
      ADMIN_PASSWORD: "staging-password",
      SESSION_SECRET: "staging-secret",
      DEFAULT_PAYMENT_PROVIDER: "make-grow",
      GROW_MODE: "mock",
      INVOICE_MODE: "mock",
      ENABLE_DEV_TOOLS: "false",
      MAKE_CREATE_PAYMENT_LINK_WEBHOOK_URL:
        "https://hook.make.com/create-payment",
      MAKE_APPROVE_TRANSACTION_WEBHOOK_URL:
        "https://hook.make.com/approve-payment",
      PUBLIC_BASE_URL: "https://payments.example/"
    });

    expect(config.makeGrowConfig?.createPaymentLinkWebhookUrl).toContain(
      "create-payment"
    );
    expect(config.makeGrowConfig?.publicBaseUrl).toBe(
      "https://payments.example"
    );
    expect(config.makeGrowStatus.hasApproveTransactionWebhook).toBe(true);
  });
});
