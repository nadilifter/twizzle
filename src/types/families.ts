/**
 * @deprecated This entire module is deprecated. Family-based data is being replaced
 * by User-based guardian relationships via AthleteGuardian. These types are retained
 * only for backward compatibility with legacy data and will be removed in a future release.
 */

// Types for Families API - matches Prisma schema and API responses

// Athlete summary for family views
export interface AthleteSummary {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "TRIAL" | "GRADUATED";
}

// Program details for enrollments in family view
export interface ProgramDetails {
  id: string;
  name: string;
  level: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
}

// Enrollment for athletes in family detail view
export interface AthleteEnrollment {
  id: string;
  athleteId: string;
  programId: string;
  startDate: string;
  endDate: string | null;
  status: "ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED";
  program: ProgramDetails;
}

// Athlete with enrollments for family detail view
export interface AthleteWithEnrollments {
  id: string;
  name: string;
  email: string | null;
  level: string;
  group: string;
  status: "ACTIVE" | "INACTIVE" | "TRIAL" | "GRADUATED";
  avatar: string | null;
  birthDate: string | null;
  enrollments: AthleteEnrollment[];
}

// Payment method
export interface PaymentMethod {
  id: string;
  familyId: string;
  type: "CARD" | "BANK";
  last4: string;
  expiry: string | null;
  brand: string | null;
  isDefault: boolean;
  createdAt: string;
}

// Line item for invoices
export interface LineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// Invoice with line items
export interface InvoiceWithLineItems {
  id: string;
  reference: string;
  familyId: string;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED" | "PARTIAL";
  dueDate: string;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  createdAt: string;
  lineItems: LineItem[];
}

// Base family type
export interface Family {
  id: string;
  name: string;
  primaryContact: string;
  email: string;
  phone: string;
  address: string | null;
  balance: number;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

// Family for list views with athlete summaries and counts
export interface FamilyWithRelations extends Family {
  athletes: AthleteSummary[];
  _count: {
    invoices: number;
    paymentMethods: number;
  };
}

// Family contact (parents, guardians, siblings, etc.)
export interface FamilyContact {
  id: string;
  familyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  relationship: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

// Family billing address
export interface FamilyBillingAddress {
  id: string;
  familyId: string;
  label: string | null;
  street: string;
  city: string;
  stateProvince: string | null;
  postalCode: string;
  country: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

// Full family detail with all related data
export interface FamilyDetail extends Family {
  athletes: AthleteWithEnrollments[];
  paymentMethods: PaymentMethod[];
  contacts: FamilyContact[];
  billingAddresses: FamilyBillingAddress[];
  invoices: InvoiceWithLineItems[];
}

// API response types
export interface FamiliesListResponse {
  data: FamilyWithRelations[];
  total: number;
  limit: number;
  offset: number;
}

// Request payload types
export interface CreateFamilyPayload {
  name: string;
  primaryContact: string;
  email: string;
  phone: string;
  address?: string;
}

export interface UpdateFamilyPayload {
  name?: string;
  primaryContact?: string;
  email?: string;
  phone?: string;
  address?: string;
}

// Query parameters for filtering families
export interface FamiliesQueryParams {
  search?: string;
  limit?: number;
  offset?: number;
}
