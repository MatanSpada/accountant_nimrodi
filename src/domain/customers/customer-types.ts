export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  externalCrmCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  externalCrmCustomerId?: string | null;
  createdAt: string;
  updatedAt: string;
}
