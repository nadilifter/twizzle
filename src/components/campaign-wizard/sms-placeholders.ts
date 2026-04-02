import type { PlaceholderDefinition } from "@/components/placeholder-picker";

export const SMS_PLACEHOLDER_DEFS: PlaceholderDefinition[] = [
  {
    key: "athleteName",
    label: "Athlete Name",
    description: "Full name of the athlete",
    example: "Emma Johnson",
    category: "athlete",
  },
  {
    key: "athleteFirstName",
    label: "Athlete First Name",
    description: "First name of the athlete",
    example: "Emma",
    category: "athlete",
  },
  {
    key: "guardianName",
    label: "Guardian Name",
    description: "Name of the guardian",
    example: "Sarah Johnson",
    category: "guardian",
  },
  {
    key: "guardianFirstName",
    label: "Guardian First Name",
    description: "First name of the guardian",
    example: "Sarah",
    category: "guardian",
  },
  {
    key: "guardianPhone",
    label: "Guardian Phone",
    description: "Phone of the guardian",
    example: "(555) 123-4567",
    category: "guardian",
  },
  {
    key: "guardianBalance",
    label: "Guardian Balance",
    description: "Guardian account balance",
    example: "$150.00",
    category: "guardian",
  },
  {
    key: "membershipName",
    label: "Membership Name",
    description: "Name of the membership instance",
    example: "Annual Membership 2026",
    category: "membership",
  },
  {
    key: "membershipGroupName",
    label: "Membership Type",
    description: "Name of the membership type",
    example: "Annual Membership",
    category: "membership",
  },
  {
    key: "membershipEndDate",
    label: "Membership End Date",
    description: "When the membership expires",
    example: "December 31, 2026",
    category: "membership",
  },
  {
    key: "membershipStatus",
    label: "Membership Status",
    description: "Current status of the membership",
    example: "Active",
    category: "membership",
  },
  {
    key: "programName",
    label: "Program Name",
    description: "Name of the program",
    example: "JO Team Training",
    category: "program",
  },
  {
    key: "organizationName",
    label: "Organization Name",
    description: "Name of your organization",
    example: "Sunrise Gymnastics",
    category: "organization",
  },
  {
    key: "organizationPhone",
    label: "Organization Phone",
    description: "Contact phone",
    example: "(555) 987-6543",
    category: "organization",
  },
  {
    key: "currentDate",
    label: "Current Date",
    description: "Today's date",
    example: "February 11, 2026",
    category: "date",
  },
];

export const SMS_PLACEHOLDER_LABEL_MAP: Record<string, string> = {};
SMS_PLACEHOLDER_DEFS.forEach((p) => {
  SMS_PLACEHOLDER_LABEL_MAP[p.key] = p.label;
});

export const SMS_QUICK_PLACEHOLDERS = [
  "guardianFirstName",
  "athleteFirstName",
  "organizationName",
  "programName",
  "membershipName",
];
