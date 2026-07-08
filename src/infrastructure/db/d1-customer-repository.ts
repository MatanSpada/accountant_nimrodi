import type {
  CustomerRepository,
  FindCustomerIdentityInput
} from "../../domain/customers/customer-repository";
import type {
  CreateCustomerInput,
  Customer
} from "../../domain/customers/customer-types";

interface D1CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  external_crm_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapCustomerRow(row: D1CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    externalCrmCustomerId: row.external_crm_customer_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class D1CustomerRepository implements CustomerRepository {
  constructor(private readonly db: D1Database) {}

  async create(input: CreateCustomerInput): Promise<Customer> {
    await this.db
      .prepare(
        `
          INSERT INTO customers (
            id,
            name,
            phone,
            email,
            external_crm_customer_id,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        input.id,
        input.name,
        input.phone,
        input.email,
        input.externalCrmCustomerId ?? null,
        input.createdAt,
        input.updatedAt
      )
      .run();

    return (await this.findById(input.id)) as Customer;
  }

  async findById(id: string): Promise<Customer | null> {
    const row = await this.db
      .prepare(
        `
          SELECT
            id,
            name,
            phone,
            email,
            external_crm_customer_id,
            created_at,
            updated_at
          FROM customers
          WHERE id = ?
        `
      )
      .bind(id)
      .first<D1CustomerRow>();

    return row ? mapCustomerRow(row) : null;
  }

  async findByIdentity(
    input: FindCustomerIdentityInput
  ): Promise<Customer | null> {
    if (input.email) {
      const byEmail = await this.db
        .prepare(
          `
            SELECT
              id,
              name,
              phone,
              email,
              external_crm_customer_id,
              created_at,
              updated_at
            FROM customers
            WHERE email = ?
            LIMIT 1
          `
        )
        .bind(input.email)
        .first<D1CustomerRow>();

      if (byEmail) {
        return mapCustomerRow(byEmail);
      }
    }

    if (input.phone) {
      const byPhone = await this.db
        .prepare(
          `
            SELECT
              id,
              name,
              phone,
              email,
              external_crm_customer_id,
              created_at,
              updated_at
            FROM customers
            WHERE phone = ?
            LIMIT 1
          `
        )
        .bind(input.phone)
        .first<D1CustomerRow>();

      if (byPhone) {
        return mapCustomerRow(byPhone);
      }
    }

    return null;
  }
}
