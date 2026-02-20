// Types for Athletes API - matches Prisma schema and API responses

export type AthleteStatus = "ACTIVE" | "INACTIVE" | "TRIAL" | "GRADUATED";

export type GenderDeclaration = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";

// Base athlete type from database
export interface Athlete {
  id: string;
  name: string; // Deprecated: use firstName + lastName
  firstName: string;
  lastName: string;
  email: string | null;
  level: string;
  status: AthleteStatus;
  avatar: string | null;
  birthDate: string | null;
  gender: GenderDeclaration | null;
  customId: string | null;
  organizationId: string | null;
  // familyId is deprecated/removed in schema, but may be present in older API responses or forms
  familyId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AthleteGuardian {
  id: string;
  athleteId: string;
  familyId: string;
  relationship: string | null;
  isPrimary: boolean;
  family: FamilySummary;
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
  guardians: AthleteGuardian[];
  family: FamilySummary;
  enrollments: EnrollmentWithProgram[];
  _count: {
    attendances: number;
    evaluations: number;
  };
  // Computed summary counts
  activePrograms: number;
  activeMemberships: number;
  upcomingCompetitions: number;
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

// Membership summary for athlete profile
export interface AthleteMembershipSummary {
  id: string;
  instanceName: string;
  groupName: string;
  groupId: string;
  status: string;
  startDate: string;
  endDate: string | null;
}

// Waiver page with signature for athlete profile
export interface WaiverPageWithSignature {
  id: string;
  pageNumber: number;
  title: string | null;
  content: string;
  signature: {
    signatureData: string;
    signedByName: string;
    signedByEmail: string;
    signedAt: string;
  } | null;
}

// Signed waiver for athlete profile
export interface AthleteWaiverSummary {
  id: string;
  title: string;
  signed: boolean;
  signedAt: string | null;
  pages: WaiverPageWithSignature[];
}

// Medical info summary for athlete profile
export interface AthleteMedicalSummary {
  id: string;
  allergies: string[];
  medications: string[];
  conditions: string[];
  dietaryRestrictions: string[];
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  additionalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Level info with color for athlete profile
export interface AthleteLevelInfo {
  id: string;
  name: string;
  color: string | null;
}

// Full athlete detail for profile page
export interface AthleteDetail extends Athlete {
  family: FamilyWithPaymentMethods;
  enrollments: EnrollmentWithProgram[];
  attendances: AttendanceWithEvent[];
  evaluations: Evaluation[];
  lineItems: LineItemWithInvoice[];
  memberships: AthleteMembershipSummary[];
  waivers: AthleteWaiverSummary[];
  medicalInfo: AthleteMedicalSummary | null;
  levelInfo: AthleteLevelInfo | null;
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
  status?: AthleteStatus;
  birthDate?: string | null;
  familyId: string;
}

export interface UpdateAthletePayload {
  name?: string;
  email?: string | null;
  level?: string;
  status?: AthleteStatus;
  birthDate?: string | null;
  familyId?: string;
}

// Query parameters for filtering athletes
export interface AthletesQueryParams {
  search?: string;
  status?: AthleteStatus;
  level?: string;
  familyId?: string;
  limit?: number;
  offset?: number;
}
