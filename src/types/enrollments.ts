// Types for Enrollments API

export type EnrollmentStatus = "ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED";

export interface Enrollment {
  id: string;
  athleteId: string;
  programId: string;
  startDate: string;
  endDate: string | null;
  status: EnrollmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentWithRelations extends Enrollment {
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    level: string;
    guardians?: Array<{
      user?: {
        id: string;
        name: string | null;
        email: string;
      } | null;
    }>;
  };
  program: {
    id: string;
    name: string;
    level: string;
  };
}

// API Response types
export interface EnrollmentsListResponse {
  data: EnrollmentWithRelations[];
  total: number;
  limit: number;
  offset: number;
}

// Request payload types
export interface CreateEnrollmentPayload {
  athleteId: string;
  programId: string;
  startDate: string;
  endDate?: string | null;
  status?: EnrollmentStatus;
}

export interface EnrollmentsQueryParams {
  athleteId?: string;
  programId?: string;
  status?: EnrollmentStatus;
  limit?: number;
  offset?: number;
}
