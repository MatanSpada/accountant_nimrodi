import { AppError } from "../errors/app-error";

export const APP_ENVS = ["development", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export const GROW_MODES = ["mock", "real"] as const;
export type GrowMode = (typeof GROW_MODES)[number];

export const INVOICE_MODES = ["mock", "grow", "external"] as const;
export type InvoiceMode = (typeof INVOICE_MODES)[number];

export interface AppConfig {
  appEnv: AppEnv;
  defaultPaymentProvider: string;
  adminPassword: string;
  sessionSecret: string;
  growMode: GrowMode;
  invoiceMode: InvoiceMode;
  enableDevTools: boolean;
}

function readEnvString(
  env: Record<string, unknown>,
  key: string
): string | undefined {
  const value = env[key];
  return typeof value === "string" ? value : undefined;
}

function parseAppEnv(rawValue?: string): AppEnv {
  const value = rawValue?.trim().toLowerCase() ?? "development";

  if (APP_ENVS.includes(value as AppEnv)) {
    return value as AppEnv;
  }

  throw new AppError("APP_ENV אינו נתמך.", 500);
}

function parseBooleanString(
  rawValue: string | undefined,
  fallback: boolean,
  key: string
) {
  if (!rawValue?.trim()) {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  throw new AppError(`${key} חייב להיות true או false.`, 500);
}

function resolveRequiredSecret(
  rawValue: string | undefined,
  fallback: string | undefined,
  key: "ADMIN_PASSWORD" | "SESSION_SECRET",
  appEnv: AppEnv
) {
  const value = rawValue?.trim() || fallback;

  if (!value) {
    throw new AppError(`${key} חסר בתצורת הסביבה.`, 500);
  }

  if (
    appEnv !== "development" &&
    (value === "dev-admin-password" || value === "dev-session-secret-change-me")
  ) {
    throw new AppError(
      `${key} חייב להיות ערך אמיתי ולא ברירת מחדל ב-${appEnv}.`,
      500
    );
  }

  return value;
}

function parseGrowMode(rawValue: string | undefined): GrowMode {
  const value = rawValue?.trim().toLowerCase() ?? "mock";

  if (!GROW_MODES.includes(value as GrowMode)) {
    throw new AppError("GROW_MODE אינו נתמך.", 500);
  }

  if (value !== "mock") {
    throw new AppError("GROW_MODE=real עדיין לא נתמך בפרויקט הזה.", 500);
  }

  return value as GrowMode;
}

function parseInvoiceMode(rawValue: string | undefined): InvoiceMode {
  const value = rawValue?.trim().toLowerCase() ?? "mock";

  if (!INVOICE_MODES.includes(value as InvoiceMode)) {
    throw new AppError("INVOICE_MODE אינו נתמך.", 500);
  }

  if (value !== "mock") {
    throw new AppError("INVOICE_MODE שאינו mock עדיין לא נתמך.", 500);
  }

  return value as InvoiceMode;
}

export function isProductionLike(appEnv: AppEnv) {
  return appEnv === "staging" || appEnv === "production";
}

export function getAppConfig(env?: Partial<Env> | Record<string, unknown>) {
  const source = (env ?? {}) as Record<string, unknown>;
  const appEnv = parseAppEnv(readEnvString(source, "APP_ENV"));
  const growMode = parseGrowMode(readEnvString(source, "GROW_MODE"));
  const invoiceMode = parseInvoiceMode(readEnvString(source, "INVOICE_MODE"));
  const enableDevTools = parseBooleanString(
    readEnvString(source, "ENABLE_DEV_TOOLS"),
    appEnv === "development",
    "ENABLE_DEV_TOOLS"
  );

  if (appEnv === "production" && enableDevTools) {
    throw new AppError(
      "ENABLE_DEV_TOOLS=true אסור ב-production מטעמי בטיחות.",
      500
    );
  }

  return {
    appEnv,
    defaultPaymentProvider:
      readEnvString(source, "DEFAULT_PAYMENT_PROVIDER") ?? "mock-grow",
    adminPassword: resolveRequiredSecret(
      readEnvString(source, "ADMIN_PASSWORD"),
      appEnv === "development" ? "dev-admin-password" : undefined,
      "ADMIN_PASSWORD",
      appEnv
    ),
    sessionSecret: resolveRequiredSecret(
      readEnvString(source, "SESSION_SECRET"),
      appEnv === "development" ? "dev-session-secret-change-me" : undefined,
      "SESSION_SECRET",
      appEnv
    ),
    growMode,
    invoiceMode,
    enableDevTools
  } satisfies AppConfig;
}
