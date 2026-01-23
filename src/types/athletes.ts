// Types for Athletes API - matches Prisma schema and API responses

export type AthleteStatus = "ACTIVE" | "INACTIVE" | "TRIAL" | "GRADUATED";

// Base athlete type from database
export interface Athlete {
  id: string;
  name: string;
  email: string | null;
  level: string;
  group: string;
  status: AthleteStatus;
  avatar: string | null;
  birthDate: string | null;
  familyId: string;
  createdAt: string;
  updatedAt: string;
}

// Family summary for athlete list views
export interface FamilySummary {
  id: string;
  name: string;
  email: string;
  primaryContact: string;
}

// Program summary for enrollments
export interface ProgramSummary {
  id: string;
  name: string;
  level: string;
}

// Enrollment with program details
export interface EnrollmentWithProgram {
  id: string;
  athleteId: string;
  programId: string;
  startDate: string;
  endDate: string | null;
  status: "ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED";
  program: ProgramSummary;
}

// Athlete with related data for list views
export interface AthleteWithRelations extends Athlete {
  family: FamilySummary;
  enrollments: EnrollmentWithProgram[];
  _count: {
    attendances: number;
    evaluations: number;
  };
  // Transformed fields for UI compatibility
  parent?: string;
}

// Event summary for attendance records
export interface EventSummary {
  id: string;
  title: string;
  date: string;
  type: string;
}

// Coach summary for evaluations
export interface CoachSummary {
  id: string;
  name: string;
}

// Skill for evaluation ratings
export interface Skill {
  id: string;
  name: string;
  category: string;
  level: string | null;
  description: string | null;
}

// Skill rating in an evaluation
export interface SkillRating {
  id: string;
  evaluationId: string;
  skillId: string;
  rating: number;
  comment: string | null;
  skill: Skill;
}

// Evaluation with full details
export interface Evaluation {
  id: string;
  athleteId: string;
  coachId: string;
  date: string;
  level: string;
  overallScore: number;
  status: "PASS" | "RETRY" | "EXCELLENT" | "SATISFACTORY";
  notes: string | null;
  coach: CoachSummary;
  skillRatings: SkillRating[];
}

// Attendance record with event details
export interface AttendanceWithEvent {
  id: string;
  athleteId: string;
  eventId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  checkedIn: string | null;
  notes: string | null;
  createdAt: string;
  event: EventSummary;
}

// Invoice summary for line items
export interface InvoiceSummary {
  id: string;
  reference: string;
  status: string;
  total: number;
}

// Line item with invoice reference
export interface LineItemWithInvoice {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
  invoice: InvoiceSummary;
}

// Payment method details
export interface PaymentMethod {
  id: string;
  familyId: string;
  type: "CARD" | "BANK";
  last4: string;
  expiry: string | null;
  brand: string | null;
  isDefault: boolean;
}

// Full family details with payment methods
export interface FamilyWithPaymentMethods extends FamilySummary {
  phone: string;
  address: string | null;
  balance: number;
  paymentMethods: PaymentMethod[];
}

// Full athlete detail for profile page
export interface AthleteDetail extends Athlete {
  family: FamilyWithPaymentMethods;
  enrollments: (EnrollmentWithProgram & {
    membershipTier?: {
      id: string;
      name: string;
      price: number;
    } | null;
  })[];
  attendances: AttendanceWithEvent[];
  evaluations: Evaluation[];
  lineItems: LineItemWithInvoice[];
}

// API response types
export interface AthletesListResponse {
  data: AthleteWithRelations[];
  total: number;
  limit: number;
  offset: number;
}

// Request payload types
export interface CreateAthletePayload {
  name: string;
  email?: string | null;
  level: string;
  group: string;
  status?: AthleteStatus;
  birthDate?: string | null;
  familyId: string;
}

export interface UpdateAthletePayload {
  name?: string;
  email?: string | null;
  level?: string;
  group?: string;
  status?: AthleteStatus;
  birthDate?: string | null;
  familyId?: string;
}

// Query parameters for filtering athletes
export interface AthletesQueryParams {
  search?: string;
  status?: AthleteStatus;
  level?: string;
  group?: string;
  familyId?: string;
  limit?: number;
  offset?: number;
}
