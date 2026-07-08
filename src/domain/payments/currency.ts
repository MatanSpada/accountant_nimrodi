import { AppError } from "../../shared/errors/app-error";

export const SUPPORTED_CURRENCIES = ["ILS", "USD", "EUR", "GBP"] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(value: string): value is Currency {
  return SUPPORTED_CURRENCIES.includes(value as Currency);
}

export function normalizeCurrency(value: string): Currency {
  const normalized = value.trim().toUpperCase();

  if (!isSupportedCurrency(normalized)) {
    throw new AppError("מטבע אינו נתמך.", 400);
  }

  return normalized;
}
