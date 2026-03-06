// Types for Staff & Scheduling API - matches Prisma schema and API responses

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACTOR" | "VOLUNTEER";
export type ShiftStatus = "SCHEDULED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type EventStaffRole = "LEAD" | "ASSISTANT" | "VOLUNTEER" | "OBSERVER";

// Certification structure
export interface Certification {
  name: string;
  expiresAt?: string | null;
  verified?: boolean;
}

// Emergency contact structure
export interface EmergencyContact {
  name: string;
  phone: string;
  relationship?: string;
}

// User info included in member/staff profiles
export interface StaffUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role?: string;
  status?: string;
}

// Member Profile (replaces StaffProfile — now backed by OrganizationMember)
export interface MemberProfile {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  status: string;
  joinedAt: string;
  employmentType: EmploymentType;
  title: string | null;
  hourlyRate: number | null;
  hireDate: string | null;
  certifications: Certification[] | null;
  phone: string | null;
  emergencyContact: EmergencyContact | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberWithUser extends MemberProfile {
  user: StaffUser;
  _count?: {
    shifts: number;
    eventAssignments: number;
  };
}

export interface MemberWithAvailability extends MemberWithUser {
  availability: MemberAvailability[];
}

// Member Availability (replaces StaffAvailability)
export interface MemberAvailability {
  id: string;
  memberId: string;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

// Backward-compatible aliases
/** @deprecated Use MemberProfile */
export type StaffProfile = MemberProfile;
/** @deprecated Use MemberWithUser */
export type StaffProfileWithUser = MemberWithUser;
/** @deprecated Use MemberWithAvailability */
export type StaffProfileWithAvailability = MemberWithAvailability;
/** @deprecated Use MemberAvailability */
export type StaffAvailability = MemberAvailability;

// Shift
export interface Shift {
  id: string;
  organizationId: string;
  memberId: string;
  facilityId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  notes: string | null;
  status: ShiftStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftWithRelations extends Shift {
  member: {
    id: string;
    title: string | null;
    user: StaffUser;
  };
  facility: {
    id: string;
    name: string;
  } | null;
}

// Schedule Template
export interface ScheduleTemplate {
  id: string;
  organizationId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleTemplateEntry {
  id: string;
  templateId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  shiftType: string;
  memberId: string | null;
  facilityId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleTemplateWithEntries extends ScheduleTemplate {
  entries: ScheduleTemplateEntry[];
  _count?: {
    entries: number;
  };
}

// Event Staff Assignment
export interface EventStaff {
  id: string;
  eventId: string;
  memberId: string;
  role: EventStaffRole;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventStaffWithProfile extends EventStaff {
  member: {
    id: string;
    title: string | null;
    user: StaffUser;
  };
}

// Request payload types
export interface CreateMemberPayload {
  userId: string;
  employmentType?: EmploymentType;
  title?: string | null;
  hourlyRate?: number | null;
  hireDate?: string | null;
  certifications?: Certification[] | null;
  phone?: string | null;
  emergencyContact?: EmergencyContact | null;
}

export interface UpdateMemberPayload extends Partial<Omit<CreateMemberPayload, "userId">> {}

/** @deprecated Use CreateMemberPayload */
export type CreateStaffPayload = CreateMemberPayload;
/** @deprecated Use UpdateMemberPayload */
export type UpdateStaffPayload = UpdateMemberPayload;

export interface CreateShiftPayload {
  memberId: string;
  facilityId?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  notes?: string | null;
  status?: ShiftStatus;
}

export interface UpdateShiftPayload extends Partial<CreateShiftPayload> {}

export interface ShiftsQueryParams {
  memberId?: string;
  facilityId?: string;
  startDate?: string;
  endDate?: string;
  status?: ShiftStatus;
}

export interface CreateScheduleTemplatePayload {
  name: string;
  isActive?: boolean;
  entries?: Omit<ScheduleTemplateEntry, "id" | "templateId" | "createdAt" | "updatedAt">[];
}

export interface UpdateScheduleTemplatePayload extends Partial<CreateScheduleTemplatePayload> {}

export interface GenerateShiftsPayload {
  startDate: string;
  endDate: string;
  overwriteExisting?: boolean;
}

export interface GenerateShiftsResponse {
  message: string;
  shiftsCreated: number;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface AddEventStaffPayload {
  memberId: string;
  role?: EventStaffRole;
  notes?: string | null;
}

export interface UpdateEventStaffPayload {
  role?: EventStaffRole;
  notes?: string | null;
}

export interface AvailabilityEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable?: boolean;
}

// Program Staff Types
export type ProgramStaffRole = "LEAD_COACH" | "ASSISTANT_COACH" | "SUBSTITUTE" | "VOLUNTEER";

export interface ProgramStaff {
  id: string;
  programId: string;
  memberId: string;
  role: ProgramStaffRole;
  isPrimary: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProgramStaffWithProfile extends ProgramStaff {
  member: {
    id: string;
    title: string | null;
    user: StaffUser;
  };
}

export interface AddProgramStaffPayload {
  memberId: string;
  role?: ProgramStaffRole;
  isPrimary?: boolean;
  notes?: string | null;
}

export interface UpdateProgramStaffPayload {
  role?: ProgramStaffRole;
  isPrimary?: boolean;
  notes?: string | null;
}
