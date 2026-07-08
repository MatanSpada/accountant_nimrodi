import type {
  CreatePaymentRequestInput,
  Payment,
  UpdatePaymentStatusInput
} from "./payment-types";

export interface CreatePaymentRecordInput extends CreatePaymentRequestInput {
  id: string;
  status: Payment["status"];
  provider: string;
  providerPaymentId: string | null;
  providerTransactionId: string | null;
  paymentUrl: string | null;
  invoiceId?: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
}

export interface PaymentRepository {
  create(input: CreatePaymentRecordInput): Promise<Payment>;
  updateStatus(input: UpdatePaymentStatusInput): Promise<Payment | null>;
  findById(id: string): Promise<Payment | null>;
  findByProviderTransactionId(
    providerTransactionId: string
  ): Promise<Payment | null>;
  list(): Promise<Payment[]>;
}
