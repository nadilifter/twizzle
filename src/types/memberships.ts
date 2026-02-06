export type BillingInterval = "MONTHLY" | "YEARLY" | "SESSION";
export type MembershipStatus = "ACTIVE" | "EXPIRED" | "CANCELLED" | "ARCHIVED";

// Types
export interface MembershipGroup {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  programTypes: string[];
  allowAutoRenew: boolean;
  createdAt: string;
  updatedAt: string;
  instances?: MembershipInstance[];
  _count?: {
    instances: number;
  };
}

export interface MembershipInstance {
  id: string;
  membershipGroupId: string;
  name: string;
  price: number;
  billingInterval: BillingInterval;
  startDate: string;
  endDate: string;
  autoRenewDate: string | null;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
  group?: MembershipGroup;
  _count?: {
    athleteMemberships: number;
  };
}

export interface AthleteMembership {
  id: string;
  athleteId: string;
  membershipInstanceId: string;
  startDate: string;
  endDate: string | null;
  status: MembershipStatus;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
  athlete?: {
    id: string;
    name: string;
    customId: string | null;
  };
  instance?: MembershipInstance;
}

export interface MembershipGroupsListResponse {
  data: MembershipGroup[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateMembershipGroupPayload {
  name: string;
  description?: string;
  programTypes?: string[];
  allowAutoRenew?: boolean;
}

export interface CreateMembershipInstancePayload {
  membershipGroupId: string;
  name: string;
  price: number;
  billingInterval: BillingInterval;
  startDate: string;
  endDate: string;
  autoRenewDate?: string;
}

export interface MembershipsQueryParams {
  limit?: number;
  offset?: number;
  include?: string;
}
