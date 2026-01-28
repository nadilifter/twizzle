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

// User info included in staff profiles
export interface StaffUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role?: string;
  status?: string;
}

// Staff Profile
export interface StaffProfile {
  id: string;
  userId: string;
  organizationId: string;
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

export interface StaffProfileWithUser extends StaffProfile {
  user: StaffUser;
  _count?: {
    shifts: number;
    eventAssignments: number;
  };
}

export interface StaffProfileWithAvailability extends StaffProfileWithUser {
  availability: StaffAvailability[];
}

// Staff Availability
export interface StaffAvailability {
  id: string;
  staffProfileId: string;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

// Shift
export interface Shift {
  id: string;
  organizationId: string;
  staffProfileId: string;
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
  staffProfile: {
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
  staffProfileId: string | null;
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
  staffProfileId: string;
  role: EventStaffRole;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventStaffWithProfile extends EventStaff {
  staffProfile: {
    id: string;
    title: string | null;
    user: StaffUser;
  };
}

// Request payload types
export interface CreateStaffPayload {
  userId: string;
  employmentType?: EmploymentType;
  title?: string | null;
  hourlyRate?: number | null;
  hireDate?: string | null;
  certifications?: Certification[] | null;
  phone?: string | null;
  emergencyContact?: EmergencyContact | null;
}

export interface UpdateStaffPayload extends Partial<Omit<CreateStaffPayload, "userId">> {}

export interface CreateShiftPayload {
  staffProfileId: string;
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
  staffProfileId?: string;
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
  staffProfileId: string;
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
