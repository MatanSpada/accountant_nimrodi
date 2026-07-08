import { createId } from "../../shared/types/entity-id";
import type { PaymentProvider } from "./payment-provider";
import type { PaymentRepository } from "./payment-repository";
import type { CreatePaymentRequestInput } from "./payment-types";
import { validateCreatePaymentRequestInput } from "./payment-validation";

export class PaymentService {
  constructor(
    private readonly dependencies: {
      paymentRepository: PaymentRepository;
      paymentProvider: PaymentProvider;
    }
  ) {}

  async createPaymentRequest(input: CreatePaymentRequestInput) {
    const validatedInput = validateCreatePaymentRequestInput(input);
    const internalPaymentId = createId("pay");
    const now = new Date().toISOString();

    const providerResponse =
      await this.dependencies.paymentProvider.createPaymentRequest({
        ...validatedInput,
        internalPaymentId
      });

    return this.dependencies.paymentRepository.create({
      ...validatedInput,
      id: internalPaymentId,
      status: providerResponse.status,
      provider: providerResponse.provider,
      providerPaymentId: providerResponse.providerPaymentId,
      providerTransactionId: providerResponse.providerTransactionId,
      paymentUrl: providerResponse.paymentUrl,
      invoiceId: null,
      createdAt: now,
      updatedAt: now,
      paidAt: null
    });
  }

  async listPayments() {
    return this.dependencies.paymentRepository.list();
  }
}
