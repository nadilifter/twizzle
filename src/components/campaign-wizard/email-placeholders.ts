import type { PlaceholderDefinition } from "@/components/placeholder-picker";

export const EMAIL_PLACEHOLDER_DEFS: PlaceholderDefinition[] = [
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
    key: "athleteLastName",
    label: "Athlete Last Name",
    description: "Last name of the athlete",
    example: "Johnson",
    category: "athlete",
  },
  {
    key: "athleteEmail",
    label: "Athlete Email",
    description: "Email address of the athlete",
    example: "emma@example.com",
    category: "athlete",
  },
  {
    key: "athleteLevel",
    label: "Athlete Level",
    description: "Current level/tier of the athlete",
    example: "Level 4",
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
    key: "guardianEmail",
    label: "Guardian Email",
    description: "Email of the guardian",
    example: "sarah@example.com",
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
    key: "membershipPrice",
    label: "Membership Price",
    description: "Price of the membership",
    example: "$299.00",
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
    key: "programDescription",
    label: "Program Description",
    description: "Description of the program",
    example: "Competitive training",
    category: "program",
  },
  {
    key: "organizationName",
    label: "Organization Name",
    description: "Name of your organization",
    example: "Sunrise Skating",
    category: "organization",
  },
  {
    key: "organizationEmail",
    label: "Organization Email",
    description: "Contact email",
    example: "info@sunrise-skating.com",
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
  {
    key: "currentYear",
    label: "Current Year",
    description: "Current year",
    example: "2026",
    category: "date",
  },
];

export const EMAIL_PLACEHOLDER_LABEL_MAP: Record<string, string> = {};
EMAIL_PLACEHOLDER_DEFS.forEach((p) => {
  EMAIL_PLACEHOLDER_LABEL_MAP[p.key] = p.label;
});

export const EMAIL_SUBJECT_QUICK_PLACEHOLDERS = [
  "guardianFirstName",
  "athleteFirstName",
  "organizationName",
  "programName",
  "membershipName",
  "currentDate",
];
