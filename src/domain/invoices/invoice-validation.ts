import { AppError } from "../../shared/errors/app-error";
import type { Payment } from "../payments/payment-types";
import type { InvoiceRecord } from "./invoice-types";

export function assertInvoiceCreatablePayment(payment: Payment) {
  if (payment.status !== "paid") {
    throw new AppError("ניתן ליצור קבלה רק עבור תשלום ששולם.", 422);
  }
}

export function canRetryInvoice(invoice: InvoiceRecord | null) {
  if (!invoice) {
    return true;
  }

  return invoice.status === "failed" || invoice.status === "pending";
}
