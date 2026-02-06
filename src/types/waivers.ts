export type WaiverStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface WaiverPage {
  id: string;
  waiverId: string;
  pageNumber: number;
  title: string | null;
  content: string; // HTML from WYSIWYG
  createdAt: string;
  updatedAt: string;
}

export interface Waiver {
  id: string;
  organizationId: string;
  title: string;
  status: WaiverStatus;
  createdAt: string;
  updatedAt: string;
  pages?: WaiverPage[];
  _count?: {
    signatures: number;
    acceptances: number;
    pages: number;
  };
}

export interface WaiverSignature {
  id: string;
  waiverId: string;
  waiverPageId: string;
  familyId: string;
  signatureData: string; // Base64 PNG
  signedByName: string;
  signedByEmail: string;
  ipAddress: string | null;
  userAgent: string | null;
  signedAt: string;
}

export interface WaiverAcceptance {
  id: string;
  waiverId: string;
  familyId: string;
  completedAt: string;
}

// Payload for creating a waiver with pages
export interface CreateWaiverPayload {
  title: string;
  status?: WaiverStatus;
  pages: Array<{
    pageNumber: number;
    title?: string;
    content: string;
  }>;
}

// Payload for updating a waiver
export interface UpdateWaiverPayload {
  title?: string;
  status?: WaiverStatus;
  pages?: Array<{
    id?: string; // Existing page ID (omit for new pages)
    pageNumber: number;
    title?: string;
    content: string;
  }>;
}

// Payload for signing waiver pages
export interface SignWaiverPayload {
  familyId: string;
  signedByName: string;
  signedByEmail: string;
  signatures: Array<{
    waiverPageId: string;
    signatureData: string; // Base64 PNG
  }>;
}

// Response from waiver check endpoint
export interface WaiverCheckResult {
  waiverId: string;
  waiverTitle: string;
  isSigned: boolean;
}
