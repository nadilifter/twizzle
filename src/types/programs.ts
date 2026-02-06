import type { ProgramStaffWithProfile } from "./staff";

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

// Simplified membership instance for program requirements
export interface ProgramRequiredMembership {
  id: string;
  name: string;
  price: number;
  billingInterval: "MONTHLY" | "YEARLY" | "SESSION";
  startDate: string;
  endDate: string;
  status: string;
  group: {
    id: string;
    name: string;
  };
}

export type ProgramType = "SINGLE_INSTANCE" | "SUBSCRIPTION" | "DROP_IN";
export type PricingModel = "FLAT_RATE" | "PER_SESSION";

// New calendar-based scheduling types
export type RecurrenceType = "NON_RECURRING" | "RECURRING";
export type RegistrationType = "ALL_INSTANCES" | "PER_INSTANCE";
export type InstanceStatus = "SCHEDULED" | "CANCELLED" | "COMPLETED";
export type RegistrationStatus = "REGISTERED" | "WAITLISTED" | "CANCELLED" | "ATTENDED" | "NO_SHOW";

export interface ProgramLevelRequirement {
  id: string;
  programId: string;
  levelId: string;
  level: {
    id: string;
    name: string;
    color: string | null;
  };
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
  
  // Program type and pricing (legacy)
  programType: ProgramType;
  pricingModel: PricingModel;
  basePrice: number | null;
  perSessionPrice: number | null;
  
  // New calendar-based scheduling
  recurrenceType: RecurrenceType;
  registrationType: RegistrationType | null;
  
  // Schedule
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  duration: number | null;
  rrule: string | null;
  
  // Location
  facilityId: string | null;
  
  // Level configuration
  levelId: string | null;
  showLevelOnSite: boolean;
  showCoachOnSite: boolean;
  
  // Capacity
  capacity: number | null;
  
  // Age restrictions
  minAge: number | null;
  maxAge: number | null;
  
  // Restriction flags
  hasLevelRestriction: boolean;
  hasCapacityRestriction: boolean;
  hasAgeRestriction: boolean;
  hasMembershipRestriction: boolean;
}

// Program Instance - individual occurrences of a program
export interface ProgramInstance {
  id: string;
  programId: string;
  date: string;
  startTime: string;
  endTime: string;
  facilityId: string | null;
  capacity: number | null;
  status: InstanceStatus;
  notes: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  program?: Program;
  facility?: {
    id: string;
    name: string;
    city: string | null;
    stateProvince: string | null;
  } | null;
  _count?: {
    registrations: number;
    attendances: number;
  };
}

// Instance Registration - per-instance program registrations
export interface InstanceRegistration {
  id: string;
  programInstanceId: string;
  athleteId: string;
  familyId: string | null;
  status: RegistrationStatus;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  programInstance?: ProgramInstance;
  athlete?: {
    id: string;
    name: string;
    avatar: string | null;
  };
  family?: {
    id: string;
    name: string;
  } | null;
}

export interface ProgramWithRelations extends Program {
  _count: {
    enrollments: number;
    events: number;
    lessonPlans: number;
  };
  membershipTiers: MembershipTier[];
  staffAssignments?: ProgramStaffWithProfile[];
  requiredMemberships?: ProgramRequiredMembership[];
  levelRequirements?: ProgramLevelRequirement[];
  programLevel?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
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
  level?: string;
  status?: ProgramStatus;
  programType?: ProgramType;
  pricingModel?: PricingModel;
  basePrice?: number | null;
  perSessionPrice?: number | null;
  // New calendar scheduling fields
  recurrenceType?: RecurrenceType;
  registrationType?: RegistrationType | null;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  duration?: number | null;
  rrule?: string | null;
  facilityId?: string | null;
  // Level configuration
  levelId?: string | null;
  showLevelOnSite?: boolean;
  showCoachOnSite?: boolean;
  capacity?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  hasLevelRestriction?: boolean;
  hasCapacityRestriction?: boolean;
  hasAgeRestriction?: boolean;
  hasMembershipRestriction?: boolean;
  // For staff assignments during creation
  staffAssignments?: Array<{
    staffProfileId: string;
    role: string;
    isPrimary: boolean;
  }>;
  // For level requirements during creation
  levelRequirementIds?: string[];
  // For membership requirements during creation
  membershipRequirementIds?: string[];
}

export interface UpdateProgramPayload {
  name?: string;
  description?: string;
  level?: string;
  status?: ProgramStatus;
  programType?: ProgramType;
  pricingModel?: PricingModel;
  basePrice?: number | null;
  perSessionPrice?: number | null;
  // New calendar scheduling fields
  recurrenceType?: RecurrenceType;
  registrationType?: RegistrationType | null;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  duration?: number | null;
  rrule?: string | null;
  facilityId?: string | null;
  // Level configuration
  levelId?: string | null;
  showLevelOnSite?: boolean;
  showCoachOnSite?: boolean;
  capacity?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  hasLevelRestriction?: boolean;
  hasCapacityRestriction?: boolean;
  hasAgeRestriction?: boolean;
  hasMembershipRestriction?: boolean;
  // For staff assignments
  staffAssignments?: Array<{
    staffProfileId: string;
    role: string;
    isPrimary: boolean;
  }>;
  // For level requirements
  levelRequirementIds?: string[];
  // For membership requirements
  membershipRequirementIds?: string[];
}

export interface ProgramsQueryParams {
  search?: string;
  status?: ProgramStatus;
  limit?: number;
  offset?: number;
}
