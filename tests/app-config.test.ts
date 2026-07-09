import { describe, expect, it } from "vitest";

import { getAppConfig } from "../src/shared/config/app-config";

describe("app config", () => {
  it("fails in production when ADMIN_PASSWORD is missing", () => {
    expect(() =>
      getAppConfig({
        APP_ENV: "production",
        SESSION_SECRET: "prod-secret",
        GROW_MODE: "mock",
        INVOICE_MODE: "mock",
        ENABLE_DEV_TOOLS: "false"
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
        ENABLE_DEV_TOOLS: "false"
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
        ENABLE_DEV_TOOLS: "true"
      })
    ).toThrow("ENABLE_DEV_TOOLS=true");
  });
});
