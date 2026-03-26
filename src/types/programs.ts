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
export type BillingInterval = "ONE_TIME" | "MONTHLY" | "YEARLY" | "SESSION";

// Calendar-based scheduling types
export type RegistrationType = "ALL_INSTANCES" | "PER_INSTANCE";
export type InstanceStatus = "SCHEDULED" | "CANCELLED" | "COMPLETED";
export type RegistrationStatus = "REGISTERED" | "WAITLISTED" | "CANCELLED";
export type EnrollmentStatus = "ACTIVE" | "WAITLISTED" | "PAUSED" | "CANCELLED" | "COMPLETED";
export type SpaceCapacityMode = "MINIMUM" | "SUM";

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
  color: string;
  status: ProgramStatus;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  
  // Pricing
  pricingModel: PricingModel;
  basePrice: number | null;
  perSessionPrice: number | null;
  billingInterval: BillingInterval;
  recurringPrice: number | null;
  
  // Registration style
  registrationType: RegistrationType;
  
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

  // Waitlist
  waitlistEnabled: boolean;
  waitlistAutoPromote: boolean;
  waitlistCapacity: number | null;
  
  // Age restrictions
  minAge: number | null;
  maxAge: number | null;
  
  // Space capacity
  hasSpaceRestriction: boolean;
  spaceCapacityMode: SpaceCapacityMode;

  // Restriction flags
  hasGenderRestriction: boolean;
  hasLevelRestriction: boolean;
  hasCapacityRestriction: boolean;
  hasAgeRestriction: boolean;
  hasMembershipRestriction: boolean;
  hasPassRestriction: boolean;
  hasWaiverRestriction: boolean;
  hasMedicalRequirement: boolean;
  
  // Gender restriction values
  allowedGenders: ("MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY")[];
  
  // Registration Window
  registrationStartDate: string | null;
  registrationStartTime: string | null;
  registrationEndDate: string | null;
  registrationEndTime: string | null;
  registrationOpen: boolean;
  earlyAccessCode: string | null;

  // Season
  seasonId?: string | null;
  season?: {
    id: string;
    name: string;
    color: string;
    startDate: string;
    endDate: string;
  } | null;
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
  userId?: string | null;
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
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export interface ProgramSpace {
  id: string;
  programId: string;
  spaceId: string;
  space: {
    id: string;
    name: string;
    capacity: number | null;
    status: string;
  };
}

export interface SpaceAvailabilitySlot {
  id: string;
  spaceId: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

export interface SpaceConflictDate {
  date: string;
  used: number;
  available: number;
}

export interface SpaceClosedDay {
  day: string;
  reason: string;
}

export interface SpaceWithAvailability {
  id: string;
  name: string;
  capacity: number | null;
  status: string;
  description: string | null;
  availability: SpaceAvailabilitySlot[];
  maxCapacity: number | null;
  availableCapacity: number | null;
  isAvailable: boolean;
  isFullyBooked: boolean;
  conflictDates: SpaceConflictDate[];
  totalConflicts: number;
  closedDays: SpaceClosedDay[];
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
  spaces?: ProgramSpace[];
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
  color?: string;
  status?: ProgramStatus;
  pricingModel?: PricingModel;
  basePrice?: number | null;
  perSessionPrice?: number | null;
  billingInterval?: BillingInterval;
  recurringPrice?: number | null;
  registrationType?: RegistrationType;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  duration?: number | null;
  rrule?: string | null;
  facilityId?: string | null;
  showCoachOnSite?: boolean;
  imageUrl?: string | null;
  capacity?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  hasLevelRestriction?: boolean;
  hasCapacityRestriction?: boolean;
  hasAgeRestriction?: boolean;
  hasMembershipRestriction?: boolean;
  hasPassRestriction?: boolean;
  hasWaiverRestriction?: boolean;
  hasMedicalRequirement?: boolean;
  hasFileRequirement?: boolean;
  fileRequirementConfig?: unknown;
  hasSpaceRestriction?: boolean;
  spaceCapacityMode?: SpaceCapacityMode;
  waitlistEnabled?: boolean;
  waitlistAutoPromote?: boolean;
  waitlistCapacity?: number | null;
  staffAssignments?: Array<{
    memberId: string;
    role: string;
    isPrimary: boolean;
  }>;
  levelRequirementIds?: string[];
  membershipRequirementIds?: string[];
  passRequirementIds?: string[];
  waiverRequirementIds?: string[];
  spaceIds?: string[];
  seasonId?: string | null;
  registrationStartDate?: string | null;
  registrationStartTime?: string | null;
  registrationEndDate?: string | null;
  registrationEndTime?: string | null;
  registrationOpen?: boolean;
  earlyAccessCode?: string | null;
}

export interface UpdateProgramPayload {
  name?: string;
  description?: string;
  color?: string;
  status?: ProgramStatus;
  pricingModel?: PricingModel;
  basePrice?: number | null;
  perSessionPrice?: number | null;
  billingInterval?: BillingInterval;
  recurringPrice?: number | null;
  registrationType?: RegistrationType;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  duration?: number | null;
  rrule?: string | null;
  facilityId?: string | null;
  showCoachOnSite?: boolean;
  imageUrl?: string | null;
  capacity?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  hasLevelRestriction?: boolean;
  hasCapacityRestriction?: boolean;
  hasAgeRestriction?: boolean;
  hasMembershipRestriction?: boolean;
  hasPassRestriction?: boolean;
  hasWaiverRestriction?: boolean;
  hasMedicalRequirement?: boolean;
  hasFileRequirement?: boolean;
  fileRequirementConfig?: unknown;
  hasSpaceRestriction?: boolean;
  spaceCapacityMode?: SpaceCapacityMode;
  waitlistEnabled?: boolean;
  waitlistAutoPromote?: boolean;
  waitlistCapacity?: number | null;
  // For staff assignments
  staffAssignments?: Array<{
    memberId: string;
    role: string;
    isPrimary: boolean;
  }>;
  // For level requirements
  levelRequirementIds?: string[];
  // For membership requirements
  membershipRequirementIds?: string[];
  // For pass requirements
  passRequirementIds?: string[];
  // For waiver requirements
  waiverRequirementIds?: string[];
  // For space assignments
  spaceIds?: string[];
  seasonId?: string | null;
  registrationStartDate?: string | null;
  registrationStartTime?: string | null;
  registrationEndDate?: string | null;
  registrationEndTime?: string | null;
  registrationOpen?: boolean;
  earlyAccessCode?: string | null;
}

export interface ProgramsQueryParams {
  search?: string;
  status?: ProgramStatus;
  seasonId?: string;
  limit?: number;
  offset?: number;
}
