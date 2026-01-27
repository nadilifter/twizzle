export type ProgramStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export interface MembershipTier {
  id: string;
  programId: string | null;
  name: string;
  price: number;
  interval: "MONTHLY" | "YEARLY" | "SESSION";
  description: string | null;
  features: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Program {
  id: string;
  name: string;
  description: string | null;
  level: string;
  status: ProgramStatus;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProgramWithRelations extends Program {
  _count: {
    enrollments: number;
    events: number;
    lessonPlans: number;
  };
  membershipTiers: MembershipTier[];
}

export interface ProgramsListResponse {
  data: ProgramWithRelations[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateProgramPayload {
  name: string;
  description?: string;
  level: string;
  status?: ProgramStatus;
}

export interface UpdateProgramPayload {
  name?: string;
  description?: string;
  level?: string;
  status?: ProgramStatus;
}

export interface ProgramsQueryParams {
  search?: string;
  status?: ProgramStatus;
  limit?: number;
  offset?: number;
}
