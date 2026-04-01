export type TargetType =
  | "ALL_USERS"
  | "ALL_MEMBERS"
  | "ALL_PROGRAM_REGISTRANTS"
  | "PROGRAM_ANY_INSTANCE"
  | "PROGRAM_SPECIFIC_INSTANCE"
  | "MEMBERSHIP_HOLDERS"
  | "SPECIFIC_USERS"
  | "ALL_GUARDIANS";

export const TARGET_TYPE_LABELS: Record<TargetType, string> = {
  ALL_USERS: "All Staff & Users",
  ALL_MEMBERS: "All Members",
  ALL_PROGRAM_REGISTRANTS: "All Program Registrants",
  PROGRAM_ANY_INSTANCE: "Program Registrants (Any Instance)",
  PROGRAM_SPECIFIC_INSTANCE: "Program Registrants (Specific Instance)",
  MEMBERSHIP_HOLDERS: "Membership Holders",
  SPECIFIC_USERS: "Specific Guardians",
  ALL_GUARDIANS: "All Guardians",
};

export const TARGET_TYPE_DESCRIPTIONS: Record<TargetType, string> = {
  ALL_USERS: "Send to all staff members, coaches, and admins in your organization.",
  ALL_MEMBERS: "Send to all guardians in your organization.",
  ALL_PROGRAM_REGISTRANTS: "Send to guardians with athletes enrolled in any active program.",
  PROGRAM_ANY_INSTANCE:
    "Send to guardians with athletes registered for any instance of a specific program.",
  PROGRAM_SPECIFIC_INSTANCE:
    "Send to guardians with athletes registered for a specific instance of a program.",
  MEMBERSHIP_HOLDERS: "Send to guardians with athletes holding specific membership types.",
  SPECIFIC_USERS: "Hand-pick specific guardians to send to.",
  ALL_GUARDIANS: "Send to all guardians in your organization.",
};

export interface ProgramOption {
  id: string;
  name: string;
}

export interface ProgramInstanceOption {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
}

export interface MembershipGroupOption {
  id: string;
  name: string;
}

export interface GuardianOption {
  id: string;
  name: string;
  email: string;
}
