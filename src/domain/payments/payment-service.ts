import type { CustomerRepository } from "../customers/customer-repository";
import { createId } from "../../shared/types/entity-id";
import type { PaymentProvider } from "./payment-provider";
import type {
  PaymentListOptions,
  PaymentRepository
} from "./payment-repository";
import type { CreatePaymentRequestInput } from "./payment-types";
import { canTransitionPaymentStatus, isPaymentStatus } from "./payment-status";
import { validateCreatePaymentDraftInput } from "./payment-validation";

export class PaymentService {
  constructor(
    private readonly dependencies: {
      paymentRepository: PaymentRepository;
      customerRepository: CustomerRepository;
      paymentProvider: PaymentProvider;
    }
  ) {}

  async createPaymentRequest(input: CreatePaymentRequestInput) {
    const validatedInput = validateCreatePaymentDraftInput(input);
    const internalPaymentId = createId("pay");
    const now = new Date().toISOString();
    const customer = await this.resolveCustomer(validatedInput, now);

    await this.dependencies.paymentRepository.create({
      ...validatedInput,
      id: internalPaymentId,
      customerId: customer?.id ?? null,
      status: "draft",
      provider: this.dependencies.paymentProvider.providerKey,
      providerPaymentId: null,
      providerTransactionId: null,
      paymentUrl: null,
      invoiceId: null,
      createdAt: now,
      updatedAt: now,
      paidAt: null,
      cancelledAt: null,
      failedAt: null
    });

    const providerResponse =
      await this.dependencies.paymentProvider.createPaymentRequest({
        ...validatedInput,
        internalPaymentId,
        customerId: customer?.id ?? null
      });

    if (!isPaymentStatus(providerResponse.status)) {
      throw new Error("Provider returned an unsupported payment status.");
    }

    if (!canTransitionPaymentStatus("draft", providerResponse.status)) {
      throw new Error(
        "Provider returned an invalid payment status transition."
      );
    }

    return this.dependencies.paymentRepository.attachProviderPaymentDetails({
      paymentId: internalPaymentId,
      status: providerResponse.status,
      providerPaymentId: providerResponse.providerPaymentId,
      providerTransactionId: providerResponse.providerTransactionId,
      paymentUrl: providerResponse.paymentUrl,
      updatedAt: new Date().toISOString()
    });
  }

  async getPaymentById(paymentId: string) {
    return this.dependencies.paymentRepository.findById(paymentId);
  }

  async getPaymentByProviderPaymentId(providerPaymentId: string) {
    return this.dependencies.paymentRepository.findByProviderPaymentId(
      providerPaymentId
    );
  }

  async listPayments(options?: PaymentListOptions) {
    return this.dependencies.paymentRepository.list(options);
  }

  private async resolveCustomer(
    input: ReturnType<typeof validateCreatePaymentDraftInput>,
    now: string
  ) {
    if (!input.customerEmail && !input.customerPhone) {
      return null;
    }

    const existing = await this.dependencies.customerRepository.findByIdentity({
      email: input.customerEmail ?? null,
      phone: input.customerPhone ?? null
    });

    if (existing) {
      return existing;
    }

    return this.dependencies.customerRepository.create({
      id: createId("cus"),
      name: input.customerName,
      phone: input.customerPhone ?? null,
      email: input.customerEmail ?? null,
      externalCrmCustomerId: null,
      createdAt: now,
      updatedAt: now
    });
  }
}
