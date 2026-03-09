// Certification types - matches Prisma schema and API responses

export type CertificationEvaluationMethod = "PASS_FAIL" | "POINT_SCALE";

// ===== Certification Definitions =====

export interface Certification {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  criteria: string | null;
  evaluationMethod: CertificationEvaluationMethod;
  pointScaleMin: number;
  pointScaleMax: number;
  passThreshold: number;
  renewalPeriodMonths: number | null;
  requiredForPrograms: boolean;
  requiredForEvents: boolean;
  requiredForCompetitions: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CertificationWithMembers extends Certification {
  memberCertifications: MemberCertificationWithMember[];
  _count?: {
    memberCertifications: number;
  };
}

// ===== Member Certifications =====

export interface MemberCertification {
  id: string;
  certificationId: string;
  memberId: string;
  grantedById: string | null;
  passed: boolean;
  score: number | null;
  notes: string | null;
  grantedAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberCertificationWithDetails extends MemberCertification {
  certification: Certification;
  grantedBy?: {
    id: string;
    user: {
      id: string;
      name: string;
    };
  } | null;
}

export interface MemberCertificationWithMember extends MemberCertification {
  member: {
    id: string;
    title: string | null;
    user: {
      id: string;
      name: string;
      email: string;
      avatar: string | null;
    };
  };
  grantedBy?: {
    id: string;
    user: {
      id: string;
      name: string;
    };
  } | null;
}

// ===== Payloads =====

export interface CreateCertificationPayload {
  name: string;
  description?: string;
  criteria?: string;
  evaluationMethod?: CertificationEvaluationMethod;
  pointScaleMin?: number;
  pointScaleMax?: number;
  passThreshold?: number;
  renewalPeriodMonths?: number | null;
  requiredForPrograms?: boolean;
  requiredForEvents?: boolean;
  requiredForCompetitions?: boolean;
  isActive?: boolean;
}

export interface UpdateCertificationPayload {
  name?: string;
  description?: string | null;
  criteria?: string | null;
  evaluationMethod?: CertificationEvaluationMethod;
  pointScaleMin?: number;
  pointScaleMax?: number;
  passThreshold?: number;
  renewalPeriodMonths?: number | null;
  requiredForPrograms?: boolean;
  requiredForEvents?: boolean;
  requiredForCompetitions?: boolean;
  isActive?: boolean;
}

export interface GrantCertificationPayload {
  memberId: string;
  passed: boolean;
  score?: number | null;
  notes?: string | null;
  grantedAt?: string;
}

export interface UpdateMemberCertificationPayload {
  passed?: boolean;
  score?: number | null;
  notes?: string | null;
  grantedAt?: string;
}

// ===== Enforcement =====

export interface CertificationCheckResult {
  memberId: string;
  memberName: string;
  missing: {
    certificationId: string;
    certificationName: string;
    reason: "not_granted" | "expired" | "failed";
  }[];
  valid: boolean;
}
