// Types for Medical Information System - matches Prisma schema and API responses

// Question types for custom medical questions
export type MedicalQuestionType = "TEXT" | "YES_NO" | "MULTIPLE_CHOICE" | "CHECKBOX";

// ============================================
// Organization Medical Form Config
// ============================================

export interface MedicalFormConfig {
  id: string;
  organizationId: string;
  collectAllergies: boolean;
  collectMedications: boolean;
  collectConditions: boolean;
  collectEmergencyContact: boolean;
  collectDietaryRestrictions: boolean;
  collectInsuranceInfo: boolean;
  requireDuringRegistration: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateMedicalFormConfigPayload {
  collectAllergies?: boolean;
  collectMedications?: boolean;
  collectConditions?: boolean;
  collectEmergencyContact?: boolean;
  collectDietaryRestrictions?: boolean;
  collectInsuranceInfo?: boolean;
  requireDuringRegistration?: boolean;
}

// ============================================
// Custom Medical Questions
// ============================================

export interface CustomMedicalQuestion {
  id: string;
  organizationId: string;
  questionText: string;
  questionType: MedicalQuestionType;
  options: string[] | null; // For MULTIPLE_CHOICE/CHECKBOX types
  required: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomMedicalQuestionPayload {
  questionText: string;
  questionType?: MedicalQuestionType;
  options?: string[];
  required?: boolean;
  displayOrder?: number;
}

export interface UpdateCustomMedicalQuestionPayload {
  questionText?: string;
  questionType?: MedicalQuestionType;
  options?: string[] | null;
  required?: boolean;
  displayOrder?: number;
  isActive?: boolean;
}

// ============================================
// Athlete Medical Info
// ============================================

export interface AthleteMedicalInfo {
  id: string;
  athleteId: string;
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
  lastUpdatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  customResponses?: CustomMedicalResponse[];
}

export interface CustomMedicalResponse {
  id: string;
  medicalInfoId: string;
  questionId: string;
  response: string;
  createdAt: string;
  updatedAt: string;
  question?: CustomMedicalQuestion;
}

// Payload for creating/updating athlete medical info
export interface UpsertAthleteMedicalInfoPayload {
  allergies?: string[];
  medications?: string[];
  conditions?: string[];
  dietaryRestrictions?: string[];
  insuranceProvider?: string | null;
  insurancePolicyNumber?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  additionalNotes?: string | null;
  customResponses?: { questionId: string; response: string }[];
}

// ============================================
// Medical Info with Relations
// ============================================

export interface AthleteMedicalInfoWithResponses extends AthleteMedicalInfo {
  customResponses: (CustomMedicalResponse & {
    question: CustomMedicalQuestion;
  })[];
}

// Athlete with medical info for list views
export interface AthleteWithMedicalInfo {
  id: string;
  name: string;
  medicalInfo: AthleteMedicalInfo | null;
  hasMedicalAlerts: boolean; // Computed: has allergies or conditions
}

// ============================================
// Medical Summary for Admin Views
// ============================================

export interface AthleteMedicalSummary {
  athleteId: string;
  athleteName: string;
  hasAllergies: boolean;
  hasConditions: boolean;
  hasMedications: boolean;
  allergiesCount: number;
  conditionsCount: number;
  medicationsCount: number;
  lastUpdated: string | null;
  isComplete: boolean; // Has required fields filled
}

export interface MedicalSummaryResponse {
  data: AthleteMedicalSummary[];
  total: number;
  withAlerts: number; // Count of athletes with allergies or conditions
  incomplete: number; // Count of athletes missing required medical info
}

// ============================================
// Standard Medical Options (UI Constants)
// ============================================

export const COMMON_ALLERGIES = [
  "Peanuts",
  "Tree Nuts",
  "Milk/Dairy",
  "Eggs",
  "Wheat/Gluten",
  "Soy",
  "Fish",
  "Shellfish",
  "Sesame",
  "Bee Stings",
  "Latex",
  "Penicillin",
  "Sulfa Drugs",
  "Aspirin",
  "Ibuprofen",
] as const;

export const COMMON_CONDITIONS = [
  "Asthma",
  "Diabetes (Type 1)",
  "Diabetes (Type 2)",
  "Epilepsy/Seizures",
  "Heart Condition",
  "ADHD",
  "Autism",
  "Anxiety",
  "Depression",
  "Hearing Impairment",
  "Vision Impairment",
  "Cerebral Palsy",
  "Down Syndrome",
  "Sickle Cell Disease",
] as const;

export const DIETARY_RESTRICTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut-Free",
  "Kosher",
  "Halal",
  "Low Sodium",
  "Diabetic Diet",
] as const;

export const EMERGENCY_CONTACT_RELATIONSHIPS = [
  "Parent",
  "Mother",
  "Father",
  "Guardian",
  "Grandparent",
  "Sibling",
  "Aunt/Uncle",
  "Other Family",
  "Friend",
  "Neighbor",
] as const;
