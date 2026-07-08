import type {
  CustomerRepository,
  FindCustomerIdentityInput
} from "../../domain/customers/customer-repository";
import type {
  CreateCustomerInput,
  Customer
} from "../../domain/customers/customer-types";

export class InMemoryCustomerRepository implements CustomerRepository {
  private readonly customers = new Map<string, Customer>();

  async create(input: CreateCustomerInput): Promise<Customer> {
    const customer: Customer = {
      id: input.id,
      name: input.name,
      phone: input.phone,
      email: input.email,
      externalCrmCustomerId: input.externalCrmCustomerId ?? null,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt
    };

    this.customers.set(customer.id, customer);
    return customer;
  }

  async findById(id: string): Promise<Customer | null> {
    return this.customers.get(id) ?? null;
  }

  async findByIdentity(
    input: FindCustomerIdentityInput
  ): Promise<Customer | null> {
    for (const customer of this.customers.values()) {
      if (input.email && customer.email === input.email) {
        return customer;
      }

      if (input.phone && customer.phone === input.phone) {
        return customer;
      }
    }

    return null;
  }
}
