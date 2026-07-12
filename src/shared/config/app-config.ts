import { AppError } from "../errors/app-error";

export const APP_ENVS = ["development", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export const GROW_MODES = ["mock", "sandbox", "production"] as const;
export type GrowMode = (typeof GROW_MODES)[number];

export const INVOICE_MODES = ["mock", "grow", "external"] as const;
export type InvoiceMode = (typeof INVOICE_MODES)[number];

export const PAYMENT_PROVIDERS = ["mock-grow", "make-grow", "grow"] as const;
export type PaymentProviderMode = (typeof PAYMENT_PROVIDERS)[number];

export type GrowBankTransferOnlyStatus =
  "not_requested" | "requested_unverified";

export interface GrowProviderConfig {
  mode: Exclude<GrowMode, "mock">;
  userId: string;
  pageCode: string;
  apiBaseUrl: string;
  successUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  invoiceNotifyUrl: string | null;
  apiKey: string | null;
  forceBankTransferOnly: boolean;
  bankTransferOnlyStatus: GrowBankTransferOnlyStatus;
}

export interface GrowConfigurationStatus {
  mode: GrowMode;
  hasRequiredConfig: boolean;
  missingFields: string[];
  hasNotifyUrl: boolean;
  hasInvoiceNotifyUrl: boolean;
  hasApiKey: boolean;
  forceBankTransferOnly: boolean;
  bankTransferOnlyStatus: GrowBankTransferOnlyStatus;
  allowMockInProduction: boolean;
}

export interface MakeGrowProviderConfig {
  createPaymentLinkWebhookUrl: string;
  createPaymentLinkSecret: string | null;
  approveTransactionWebhookUrl: string | null;
  approveTransactionSecret: string | null;
  publicBaseUrl: string;
}

export interface MakeGrowConfigurationStatus {
  hasRequiredConfig: boolean;
  missingFields: string[];
  hasApproveTransactionWebhook: boolean;
  hasCreateSecret: boolean;
  hasApproveSecret: boolean;
  hasPublicBaseUrl: boolean;
}

export interface AppConfig {
  appEnv: AppEnv;
  defaultPaymentProvider: PaymentProviderMode;
  adminPassword: string;
  sessionSecret: string;
  growMode: GrowMode;
  growConfig: GrowProviderConfig | null;
  growStatus: GrowConfigurationStatus;
  makeGrowConfig: MakeGrowProviderConfig | null;
  makeGrowStatus: MakeGrowConfigurationStatus;
  invoiceMode: InvoiceMode;
  enableDevTools: boolean;
}

const DEV_ADMIN_PASSWORD = "dev-admin-password";
const DEV_SESSION_SECRET = "dev-session-secret-change-me";

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
    (value === DEV_ADMIN_PASSWORD || value === DEV_SESSION_SECRET)
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

  if (GROW_MODES.includes(value as GrowMode)) {
    return value as GrowMode;
  }

  throw new AppError("GROW_MODE אינו נתמך.", 500);
}

function parsePaymentProviderMode(
  rawValue: string | undefined,
  growMode: GrowMode
): PaymentProviderMode {
  const value = rawValue?.trim().toLowerCase();
  const fallback = growMode === "mock" ? "mock-grow" : "grow";
  const normalized = value || fallback;

  if (PAYMENT_PROVIDERS.includes(normalized as PaymentProviderMode)) {
    return normalized as PaymentProviderMode;
  }

  throw new AppError("DEFAULT_PAYMENT_PROVIDER אינו נתמך.", 500);
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

function requireNonEmptyEnv(
  env: Record<string, unknown>,
  key: string,
  missingFields: string[]
) {
  const value = readEnvString(env, key)?.trim();

  if (!value) {
    missingFields.push(key);
    return null;
  }

  return value;
}

function resolveGrowConfiguration(input: {
  env: Record<string, unknown>;
  appEnv: AppEnv;
  growMode: GrowMode;
  paymentProvider: PaymentProviderMode;
}) {
  const allowMockInProduction = parseBooleanString(
    readEnvString(input.env, "ALLOW_MOCK_GROW_IN_PRODUCTION"),
    false,
    "ALLOW_MOCK_GROW_IN_PRODUCTION"
  );
  const forceBankTransferOnly = parseBooleanString(
    readEnvString(input.env, "GROW_FORCE_BANK_TRANSFER_ONLY"),
    false,
    "GROW_FORCE_BANK_TRANSFER_ONLY"
  );
  const bankTransferOnlyStatus: GrowBankTransferOnlyStatus =
    forceBankTransferOnly ? "requested_unverified" : "not_requested";

  if (input.paymentProvider !== "grow") {
    return {
      config: null,
      status: {
        mode: input.growMode,
        hasRequiredConfig: false,
        missingFields: [],
        hasNotifyUrl: false,
        hasInvoiceNotifyUrl: false,
        hasApiKey: false,
        forceBankTransferOnly,
        bankTransferOnlyStatus,
        allowMockInProduction
      } satisfies GrowConfigurationStatus
    };
  }

  if (input.growMode === "mock") {
    if (input.appEnv === "production" && !allowMockInProduction) {
      throw new AppError(
        "GROW_MODE=mock ב-production דורש ALLOW_MOCK_GROW_IN_PRODUCTION=true או מעבר ל-sandbox/production עם פרטי GROW מאומתים.",
        500
      );
    }

    return {
      config: null,
      status: {
        mode: input.growMode,
        hasRequiredConfig: false,
        missingFields: [],
        hasNotifyUrl: false,
        hasInvoiceNotifyUrl: false,
        hasApiKey: false,
        forceBankTransferOnly,
        bankTransferOnlyStatus,
        allowMockInProduction
      } satisfies GrowConfigurationStatus
    };
  }

  const missingFields: string[] = [];
  const userId = requireNonEmptyEnv(input.env, "GROW_USER_ID", missingFields);
  const pageCode = requireNonEmptyEnv(
    input.env,
    "GROW_PAGE_CODE",
    missingFields
  );
  const apiBaseUrl = requireNonEmptyEnv(
    input.env,
    "GROW_API_BASE_URL",
    missingFields
  );
  const successUrl = requireNonEmptyEnv(
    input.env,
    "GROW_SUCCESS_URL",
    missingFields
  );
  const cancelUrl = requireNonEmptyEnv(
    input.env,
    "GROW_CANCEL_URL",
    missingFields
  );
  const notifyUrl = requireNonEmptyEnv(
    input.env,
    "GROW_NOTIFY_URL",
    missingFields
  );
  const invoiceNotifyUrl =
    readEnvString(input.env, "GROW_INVOICE_NOTIFY_URL")?.trim() || null;
  const apiKey = readEnvString(input.env, "GROW_API_KEY")?.trim() || null;

  if (missingFields.length > 0) {
    throw new AppError(
      `חסרים שדות GROW נדרשים עבור GROW_MODE=${input.growMode}: ${missingFields.join(", ")}`,
      500
    );
  }

  return {
    config: {
      mode: input.growMode,
      userId: userId as string,
      pageCode: pageCode as string,
      apiBaseUrl: apiBaseUrl as string,
      successUrl: successUrl as string,
      cancelUrl: cancelUrl as string,
      notifyUrl: notifyUrl as string,
      invoiceNotifyUrl,
      apiKey,
      forceBankTransferOnly,
      bankTransferOnlyStatus
    } satisfies GrowProviderConfig,
    status: {
      mode: input.growMode,
      hasRequiredConfig: true,
      missingFields: [],
      hasNotifyUrl: true,
      hasInvoiceNotifyUrl: Boolean(invoiceNotifyUrl),
      hasApiKey: Boolean(apiKey),
      forceBankTransferOnly,
      bankTransferOnlyStatus,
      allowMockInProduction
    } satisfies GrowConfigurationStatus
  };
}

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed;
}

function resolveMakeGrowConfiguration(input: {
  env: Record<string, unknown>;
  paymentProvider: PaymentProviderMode;
}) {
  const missingFields: string[] = [];
  const createPaymentLinkWebhookUrl = requireNonEmptyEnv(
    input.env,
    "MAKE_CREATE_PAYMENT_LINK_WEBHOOK_URL",
    missingFields
  );
  const publicBaseUrl = requireNonEmptyEnv(
    input.env,
    "PUBLIC_BASE_URL",
    missingFields
  );
  const createPaymentLinkSecret =
    readEnvString(input.env, "MAKE_CREATE_PAYMENT_LINK_SECRET")?.trim() || null;
  const approveTransactionWebhookUrl =
    readEnvString(input.env, "MAKE_APPROVE_TRANSACTION_WEBHOOK_URL")?.trim() ||
    null;
  const approveTransactionSecret =
    readEnvString(input.env, "MAKE_APPROVE_TRANSACTION_SECRET")?.trim() || null;

  if (input.paymentProvider !== "make-grow" && missingFields.length > 0) {
    return {
      config: null,
      status: {
        hasRequiredConfig: false,
        missingFields: [],
        hasApproveTransactionWebhook: Boolean(approveTransactionWebhookUrl),
        hasCreateSecret: Boolean(createPaymentLinkSecret),
        hasApproveSecret: Boolean(approveTransactionSecret),
        hasPublicBaseUrl: Boolean(publicBaseUrl)
      } satisfies MakeGrowConfigurationStatus
    };
  }

  if (missingFields.length > 0) {
    return {
      config: null,
      status: {
        hasRequiredConfig: false,
        missingFields,
        hasApproveTransactionWebhook: Boolean(approveTransactionWebhookUrl),
        hasCreateSecret: Boolean(createPaymentLinkSecret),
        hasApproveSecret: Boolean(approveTransactionSecret),
        hasPublicBaseUrl: Boolean(publicBaseUrl)
      } satisfies MakeGrowConfigurationStatus
    };
  }

  return {
    config: {
      createPaymentLinkWebhookUrl: createPaymentLinkWebhookUrl as string,
      createPaymentLinkSecret,
      approveTransactionWebhookUrl,
      approveTransactionSecret,
      publicBaseUrl: normalizeBaseUrl(publicBaseUrl as string)
    } satisfies MakeGrowProviderConfig,
    status: {
      hasRequiredConfig: true,
      missingFields: [],
      hasApproveTransactionWebhook: Boolean(approveTransactionWebhookUrl),
      hasCreateSecret: Boolean(createPaymentLinkSecret),
      hasApproveSecret: Boolean(approveTransactionSecret),
      hasPublicBaseUrl: true
    } satisfies MakeGrowConfigurationStatus
  };
}

export function isProductionLike(appEnv: AppEnv) {
  return appEnv === "staging" || appEnv === "production";
}

export function getAppConfig(env?: Partial<Env> | Record<string, unknown>) {
  const source = (env ?? {}) as Record<string, unknown>;
  const appEnv = parseAppEnv(readEnvString(source, "APP_ENV"));
  const growMode = parseGrowMode(readEnvString(source, "GROW_MODE"));
  const defaultPaymentProvider = parsePaymentProviderMode(
    readEnvString(source, "DEFAULT_PAYMENT_PROVIDER"),
    growMode
  );
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

  const grow = resolveGrowConfiguration({
    env: source,
    appEnv,
    growMode,
    paymentProvider: defaultPaymentProvider
  });
  const makeGrow = resolveMakeGrowConfiguration({
    env: source,
    paymentProvider: defaultPaymentProvider
  });

  if (defaultPaymentProvider === "grow") {
    if (growMode === "mock") {
      throw new AppError(
        "DEFAULT_PAYMENT_PROVIDER=grow דורש GROW_MODE=sandbox או GROW_MODE=production.",
        500
      );
    }

    if (!grow.config) {
      throw new AppError(
        "תצורת GROW הישירה חסרה עבור DEFAULT_PAYMENT_PROVIDER=grow.",
        500
      );
    }
  }

  return {
    appEnv,
    defaultPaymentProvider,
    adminPassword: resolveRequiredSecret(
      readEnvString(source, "ADMIN_PASSWORD"),
      appEnv === "development" ? DEV_ADMIN_PASSWORD : undefined,
      "ADMIN_PASSWORD",
      appEnv
    ),
    sessionSecret: resolveRequiredSecret(
      readEnvString(source, "SESSION_SECRET"),
      appEnv === "development" ? DEV_SESSION_SECRET : undefined,
      "SESSION_SECRET",
      appEnv
    ),
    growMode,
    growConfig: grow.config,
    growStatus: grow.status,
    makeGrowConfig: makeGrow.config,
    makeGrowStatus: makeGrow.status,
    invoiceMode,
    enableDevTools
  } satisfies AppConfig;
}
