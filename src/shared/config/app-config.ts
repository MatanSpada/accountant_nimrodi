export interface AppConfig {
  appEnv: string;
  defaultPaymentProvider: string;
}

export function getAppConfig(env?: Partial<Env>): AppConfig {
  return {
    appEnv: env?.APP_ENV ?? "development",
    defaultPaymentProvider: env?.DEFAULT_PAYMENT_PROVIDER ?? "mock-grow"
  };
}
