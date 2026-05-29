// Types for Athletes API - matches Prisma schema and API responses

export type AthleteStatus = "ACTIVE" | "INACTIVE" | "TRIAL" | "GRADUATED";

export type GenderDeclaration = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";

export type Discipline = "SINGLES" | "PAIRS" | "ICE_DANCE" | "SYNCHRO" | "SPECIAL_OLYMPICS";

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  SINGLES: "Singles",
  PAIRS: "Pairs",
  ICE_DANCE: "Ice Dance",
  SYNCHRO: "Synchronized",
  SPECIAL_OLYMPICS: "Special Olympics",
};

export const DISCIPLINE_VALUES: Discipline[] = [
  "SINGLES",
  "PAIRS",
  "ICE_DANCE",
  "SYNCHRO",
  "SPECIAL_OLYMPICS",
];

// Base athlete type from database (global fields)
// level, status, customId come from OrganizationAthlete but are flattened into API responses
export interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  level: string;
  status: AthleteStatus;
  avatar: string | null;
  birthDate: string | null;
  gender: GenderDeclaration | null;
  disciplines: Discipline[];
  customId: string | null;
  federationName: string | null;
  federationMemberNumber: string | null;
  federationMemberExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GuardianUserSummary {
  id: string;
  name: string | null;
  email: string;
}

export interface AthleteGuardian {
  id: string;
  athleteId: string;
  userId?: string | null;
  relationship: string | null;
  isPrimary: boolean;
  user?: GuardianUserSummary | null;
}

// Program summary for enrollments
export interface ProgramSummary {
  id: string;
  name: string;
  description?: string | null;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  pricingModel?: "FLAT_RATE" | "PER_SESSION";
  basePrice?: number | null;
  perSessionPrice?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  duration?: number | null;
  capacity?: number | null;
}

// Enrollment with program details
export interface EnrollmentWithProgram {
  id: string;
  athleteId: string;
  programId: string;
  startDate: string;
  endDate: string | null;
  status: "ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED";
  createdAt?: string;
  program: ProgramSummary;
}

export interface AthleteProgramRef {
  id: string;
  name: string;
}

export interface AthleteMembershipGroupRef {
  id: string;
  name: string;
}

// Athlete with related data for list views
export interface AthleteWithRelations extends Athlete {
  guardians: AthleteGuardian[];
  enrollments: EnrollmentWithProgram[];
  _count: {
    attendances: number;
    evaluations: number;
  };
  // Computed summary counts
  activePrograms: number;
  activeMemberships: number;
  upcomingCompetitions: number;
  // Filterable lists derived server-side from active enrollments / memberships
  activeProgramList: AthleteProgramRef[];
  activeMembershipGroupList: AthleteMembershipGroupRef[];
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
  levelId: string | null;
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
  userId: string;
  type: "CARD" | "BANK";
  last4: string;
  expiry: string | null;
  brand: string | null;
  isDefault: boolean;
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

// Competition entry for athlete profile
export interface CompetitionEntrySummary {
  id: string;
  competitionId: string;
  competitionName: string;
  competitionStartDate: string;
  competitionEndDate: string;
  competitionStartTime: string;
  competitionEndTime: string;
  competitionStatus: string;
  location: string | null;
  facilityName: string | null;
  category: string;
  status: "PENDING_SEED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "SCRATCHED";
  createdAt: string;
  link: string;
}

// Event (program instance) registration for athlete profile
export interface EventRegistrationSummary {
  id: string;
  programInstanceId: string;
  programId: string;
  programName: string;
  date: string;
  startTime: string;
  endTime: string;
  instanceStatus: string;
  facilityName: string | null;
  status: "REGISTERED" | "WAITLISTED" | "CANCELLED";
  attendanceStatus: "REGISTERED" | "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | null;
  createdAt: string;
}

// Full athlete detail for profile page
export interface AthleteDetail extends Athlete {
  guardians: AthleteGuardian[];
  enrollments: EnrollmentWithProgram[];
  attendances: AttendanceWithEvent[];
  evaluations: Evaluation[];
  lineItems: LineItemWithInvoice[];
  memberships: AthleteMembershipSummary[];
  waivers: AthleteWaiverSummary[];
  competitionEntries: CompetitionEntrySummary[];
  eventRegistrations: EventRegistrationSummary[];
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
  guardianUserId: string;
}

export interface UpdateAthletePayload {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  level?: string;
  status?: AthleteStatus;
  birthDate?: string | null;
  guardianUserId?: string;
  federationName?: string | null;
  federationMemberNumber?: string | null;
  federationMemberExpiresAt?: string | null;
  disciplines?: Discipline[];
}

// Query parameters for filtering athletes
export interface AthletesQueryParams {
  search?: string;
  status?: AthleteStatus;
  level?: string;
  limit?: number;
  offset?: number;
}
