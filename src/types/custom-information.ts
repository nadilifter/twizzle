export type CustomInfoQuestionType =
  | "VALUE"
  | "BOOLEAN"
  | "SIGNATURE"
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "IMAGE";

export type CustomInfoScopeType =
  | "ALL_PROGRAMS"
  | "ALL_EVENTS"
  | "ALL_COMPETITIONS"
  | "ALL_MEMBERSHIPS"
  | "ALL_PASSES"
  | "PROGRAM"
  | "EVENT"
  | "COMPETITION"
  | "MEMBERSHIP"
  | "PASS"
  | "SEASON";

export const QUESTION_TYPE_LABELS: Record<CustomInfoQuestionType, string> = {
  VALUE: "Number",
  BOOLEAN: "Yes / No",
  SIGNATURE: "Signature",
  SHORT_TEXT: "Short Text",
  LONG_TEXT: "Long Text",
  IMAGE: "Image Upload",
};

export const SCOPE_TYPE_LABELS: Record<CustomInfoScopeType, string> = {
  ALL_PROGRAMS: "All Programs",
  ALL_EVENTS: "All Events",
  ALL_COMPETITIONS: "All Competitions",
  ALL_MEMBERSHIPS: "All Memberships",
  ALL_PASSES: "All Passes",
  PROGRAM: "Specific Program",
  EVENT: "Specific Event",
  COMPETITION: "Specific Competition",
  MEMBERSHIP: "Specific Membership",
  PASS: "Specific Pass",
  SEASON: "Season",
};

// ============================================
// Config
// ============================================

export interface CustomInfoConfig {
  id: string;
  organizationId: string;
  validityDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCustomInfoConfigPayload {
  validityDays?: number;
}

// ============================================
// Questions
// ============================================

export interface CustomInfoQuestionScope {
  id: string;
  questionId: string;
  scopeType: CustomInfoScopeType;
  targetId: string | null;
  targetName?: string;
}

export interface CustomInfoQuestion {
  id: string;
  organizationId: string;
  questionText: string;
  description: string | null;
  questionType: CustomInfoQuestionType;
  required: boolean;
  displayOrder: number;
  isActive: boolean;
  valueMin: number | null;
  valueMax: number | null;
  allowDecimals: boolean;
  requireSignatureOnYes: boolean;
  scopes: CustomInfoQuestionScope[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomInfoQuestionPayload {
  questionText: string;
  description?: string | null;
  questionType: CustomInfoQuestionType;
  required?: boolean;
  displayOrder?: number;
  valueMin?: number | null;
  valueMax?: number | null;
  allowDecimals?: boolean;
  requireSignatureOnYes?: boolean;
  scopes: { scopeType: CustomInfoScopeType; targetId?: string | null }[];
}

export interface UpdateCustomInfoQuestionPayload {
  questionText?: string;
  description?: string | null;
  questionType?: CustomInfoQuestionType;
  required?: boolean;
  displayOrder?: number;
  isActive?: boolean;
  valueMin?: number | null;
  valueMax?: number | null;
  allowDecimals?: boolean;
  requireSignatureOnYes?: boolean;
  scopes?: { scopeType: CustomInfoScopeType; targetId?: string | null }[];
}

// ============================================
// Responses
// ============================================

export interface CustomInfoResponse {
  id: string;
  athleteId: string;
  organizationId: string;
  questionId: string;
  responseValue: string | null;
  signatureData: string | null;
  fileUrl: string | null;
  storageKey: string | null;
  fileName: string | null;
  contentType: string | null;
  respondedAt: string;
  respondedById: string | null;
  createdAt: string;
  updatedAt: string;
  question?: CustomInfoQuestion;
}

export interface CustomInfoResponseWithQuestion extends CustomInfoResponse {
  question: CustomInfoQuestion;
}

export interface UpsertCustomInfoResponsePayload {
  questionId: string;
  responseValue?: string | null;
  signatureData?: string | null;
}

export interface CustomInfoResponsesByOrg {
  organizationId: string;
  organizationName: string;
  responses: CustomInfoResponseWithQuestion[];
  validityDays: number;
}
