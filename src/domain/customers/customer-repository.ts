import type { CreateCustomerInput, Customer } from "./customer-types";

export interface FindCustomerIdentityInput {
  email: string | null;
  phone: string | null;
}

export interface CustomerRepository {
  create(input: CreateCustomerInput): Promise<Customer>;
  findById(id: string): Promise<Customer | null>;
  findByIdentity(input: FindCustomerIdentityInput): Promise<Customer | null>;
}
