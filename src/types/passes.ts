export type BillingInterval = "ONE_TIME" | "MONTHLY" | "YEARLY" | "SESSION";
export type PassStatus = "ACTIVE" | "EXPIRED" | "CANCELLED" | "ARCHIVED";
export type PassLimitPeriod = "WEEKLY" | "MONTHLY";

export interface Pass {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billingInterval: BillingInterval;
  sessionLimit: number;
  limitPeriod: PassLimitPeriod;
  coversAllPrograms: boolean;
  status: PassStatus;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  coveredPrograms?: PassProgram[];
  requiredForPrograms?: PassProgram[];
  athletePasses?: AthletePass[];
  _count?: {
    athletePasses: number;
    coveredPrograms: number;
  };
}

export interface PassProgram {
  id: string;
  name: string;
  status: string;
  basePrice: number | null;
  perSessionPrice: number | null;
  pricingModel: string;
}

export interface AthletePass {
  id: string;
  passId: string;
  athleteId: string;
  userId: string | null;
  startDate: string;
  endDate: string | null;
  status: PassStatus;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
  athlete?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  pass?: Pass;
}

export interface PassesListResponse {
  data: Pass[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreatePassPayload {
  name: string;
  description?: string;
  price: number;
  billingInterval: BillingInterval;
  sessionLimit: number;
  limitPeriod: PassLimitPeriod;
  coversAllPrograms?: boolean;
  programIds?: string[];
}

export interface UpdatePassPayload extends Partial<Omit<CreatePassPayload, "programIds">> {
  status?: PassStatus;
  programIds?: string[];
}

export interface PassesQueryParams {
  limit?: number;
  offset?: number;
  include?: string;
}
