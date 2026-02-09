import type { ProgramStaffWithProfile } from "./staff";

export type ProgramStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

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

export type PricingModel = "FLAT_RATE" | "PER_SESSION";

// Calendar-based scheduling types
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

export interface ProgramWaiverRequirement {
  id: string;
  programId: string;
  waiverId: string;
  waiver: {
    id: string;
    title: string;
    status: string;
  };
}

export interface Program {
  id: string;
  name: string;
  description: string | null;
  status: ProgramStatus;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  
  // Pricing
  pricingModel: PricingModel;
  basePrice: number | null;
  perSessionPrice: number | null;
  
  // Calendar-based scheduling
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
  
  // Display
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
  hasWaiverRestriction: boolean;
  hasMedicalRequirement: boolean;
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
  staffAssignments?: ProgramStaffWithProfile[];
  requiredMemberships?: ProgramRequiredMembership[];
  levelRequirements?: ProgramLevelRequirement[];
  waiverRequirements?: ProgramWaiverRequirement[];
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
  status?: ProgramStatus;
  pricingModel?: PricingModel;
  basePrice?: number | null;
  perSessionPrice?: number | null;
  recurrenceType?: RecurrenceType;
  registrationType?: RegistrationType | null;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  duration?: number | null;
  rrule?: string | null;
  facilityId?: string | null;
  showCoachOnSite?: boolean;
  capacity?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  hasLevelRestriction?: boolean;
  hasCapacityRestriction?: boolean;
  hasAgeRestriction?: boolean;
  hasMembershipRestriction?: boolean;
  hasWaiverRestriction?: boolean;
  hasMedicalRequirement?: boolean;
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
  // For waiver requirements during creation
  waiverRequirementIds?: string[];
}

export interface UpdateProgramPayload {
  name?: string;
  description?: string;
  status?: ProgramStatus;
  pricingModel?: PricingModel;
  basePrice?: number | null;
  perSessionPrice?: number | null;
  recurrenceType?: RecurrenceType;
  registrationType?: RegistrationType | null;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  duration?: number | null;
  rrule?: string | null;
  facilityId?: string | null;
  showCoachOnSite?: boolean;
  capacity?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  hasLevelRestriction?: boolean;
  hasCapacityRestriction?: boolean;
  hasAgeRestriction?: boolean;
  hasMembershipRestriction?: boolean;
  hasWaiverRestriction?: boolean;
  hasMedicalRequirement?: boolean;
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
  // For waiver requirements
  waiverRequirementIds?: string[];
}

export interface ProgramsQueryParams {
  search?: string;
  status?: ProgramStatus;
  limit?: number;
  offset?: number;
}
