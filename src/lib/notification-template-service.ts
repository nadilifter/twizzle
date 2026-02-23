/**
 * Notification Template Service
 * 
 * Handles template rendering with placeholders for the notification system.
 * Provides placeholder validation, rendering, and metadata.
 */

import type { NotificationTriggerType } from "@prisma/client";

// ============================================
// Types
// ============================================

export interface PlaceholderDefinition {
  key: string;
  label: string;
  description: string;
  example: string;
  category: PlaceholderCategory;
}

export type PlaceholderCategory = 
  | "athlete"
  | "family"
  | "guardian"
  | "membership"
  | "program"
  | "event"
  | "payment"
  | "organization"
  | "date";

export interface TemplateContext {
  // Athlete context
  athleteName?: string;
  athleteFirstName?: string;
  athleteLastName?: string;
  athleteEmail?: string;
  athleteLevel?: string;
  athleteBirthDate?: string;
  athleteAge?: number;
  
  // Family context
  familyName?: string;
  primaryContact?: string;
  primaryContactFirstName?: string;
  familyEmail?: string;
  familyPhone?: string;
  familyBalance?: string;
  
  // Guardian context (user-based guardian)
  guardianName?: string;
  guardianEmail?: string;
  guardianPhone?: string;
  guardianBalance?: string;
  
  // Membership context
  membershipName?: string;
  membershipGroupName?: string;
  membershipStartDate?: string;
  membershipEndDate?: string;
  membershipDaysRemaining?: number;
  membershipStatus?: string;
  membershipPrice?: string;
  
  // Program context
  programName?: string;
  programDescription?: string;
  
  // Event context
  eventName?: string;
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  eventDescription?: string;
  
  // Payment context
  invoiceAmount?: string;
  invoiceReference?: string;
  invoiceDescription?: string;
  dueDate?: string;
  dueDaysRemaining?: number;
  paymentUrl?: string;
  balanceDue?: string;
  
  // Organization context
  organizationName?: string;
  organizationEmail?: string;
  organizationPhone?: string;
  organizationAddress?: string;
  websiteUrl?: string;
  
  // Date context
  currentDate?: string;
  currentYear?: string;
}

export interface RenderResult {
  rendered: string;
  missingPlaceholders: string[];
  usedPlaceholders: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  usedPlaceholders: string[];
  unknownPlaceholders: string[];
}

// ============================================
// Placeholder Definitions
// ============================================

/**
 * All available placeholders with metadata
 */
export const PLACEHOLDER_DEFINITIONS: PlaceholderDefinition[] = [
  // Athlete placeholders
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
    description: "Email address of the athlete (if available)",
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
    key: "athleteBirthDate",
    label: "Athlete Birth Date",
    description: "Birth date of the athlete",
    example: "January 15, 2015",
    category: "athlete",
  },
  {
    key: "athleteAge",
    label: "Athlete Age",
    description: "Current age of the athlete",
    example: "11",
    category: "athlete",
  },

  // Family placeholders
  {
    key: "familyName",
    label: "Family Name",
    description: "Name of the family/account",
    example: "Johnson Family",
    category: "family",
  },
  {
    key: "primaryContact",
    label: "Primary Contact Name",
    description: "Full name of the primary contact",
    example: "Sarah Johnson",
    category: "family",
  },
  {
    key: "primaryContactFirstName",
    label: "Primary Contact First Name",
    description: "First name of the primary contact",
    example: "Sarah",
    category: "family",
  },
  {
    key: "familyEmail",
    label: "Family Email",
    description: "Primary email for the family",
    example: "sarah@example.com",
    category: "family",
  },
  {
    key: "familyPhone",
    label: "Family Phone",
    description: "Primary phone number for the family",
    example: "(555) 123-4567",
    category: "family",
  },
  {
    key: "familyBalance",
    label: "Family Balance",
    description: "Current account balance",
    example: "$150.00",
    category: "family",
  },

  // Guardian placeholders (user-based guardian)
  {
    key: "guardianName",
    label: "Guardian Name",
    description: "Name of the guardian user (when using user-based guardianship)",
    example: "Sarah Johnson",
    category: "guardian",
  },
  {
    key: "guardianEmail",
    label: "Guardian Email",
    description: "Email address of the guardian user",
    example: "sarah@example.com",
    category: "guardian",
  },
  {
    key: "guardianPhone",
    label: "Guardian Phone",
    description: "Phone number of the guardian user",
    example: "(555) 123-4567",
    category: "guardian",
  },
  {
    key: "guardianBalance",
    label: "Guardian Balance",
    description: "Current account balance of the guardian user",
    example: "$150.00",
    category: "guardian",
  },

  // Membership placeholders
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
    description: "Name of the membership group/type",
    example: "Annual Membership",
    category: "membership",
  },
  {
    key: "membershipStartDate",
    label: "Membership Start Date",
    description: "When the membership started",
    example: "January 1, 2026",
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
    key: "membershipDaysRemaining",
    label: "Days Until Expiry",
    description: "Number of days until membership expires",
    example: "30",
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

  // Program placeholders
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
    example: "Competitive training for JO athletes",
    category: "program",
  },

  // Event placeholders
  {
    key: "eventName",
    label: "Event Name",
    description: "Name of the event",
    example: "Spring Competition",
    category: "event",
  },
  {
    key: "eventDate",
    label: "Event Date",
    description: "Date of the event",
    example: "March 15, 2026",
    category: "event",
  },
  {
    key: "eventTime",
    label: "Event Time",
    description: "Start time of the event",
    example: "9:00 AM",
    category: "event",
  },
  {
    key: "eventLocation",
    label: "Event Location",
    description: "Location of the event",
    example: "Main Gym - Floor Area",
    category: "event",
  },
  {
    key: "eventDescription",
    label: "Event Description",
    description: "Description of the event",
    example: "Regional qualifier competition",
    category: "event",
  },

  // Payment placeholders
  {
    key: "invoiceAmount",
    label: "Invoice Amount",
    description: "Total amount due on the invoice",
    example: "$250.00",
    category: "payment",
  },
  {
    key: "invoiceReference",
    label: "Invoice Reference",
    description: "Invoice reference number",
    example: "INV-2026-0042",
    category: "payment",
  },
  {
    key: "invoiceDescription",
    label: "Invoice Description",
    description: "Description of what the invoice is for",
    example: "February tuition - JO Team",
    category: "payment",
  },
  {
    key: "dueDate",
    label: "Due Date",
    description: "Payment due date",
    example: "February 15, 2026",
    category: "payment",
  },
  {
    key: "dueDaysRemaining",
    label: "Days Until Due",
    description: "Number of days until payment is due",
    example: "7",
    category: "payment",
  },
  {
    key: "paymentUrl",
    label: "Payment URL",
    description: "Link to make payment online",
    example: "https://pay.uplifterinc.com/inv/abc123",
    category: "payment",
  },
  {
    key: "balanceDue",
    label: "Balance Due",
    description: "Remaining balance to be paid",
    example: "$150.00",
    category: "payment",
  },

  // Organization placeholders
  {
    key: "organizationName",
    label: "Organization Name",
    description: "Name of the organization",
    example: "Sunrise Gymnastics Academy",
    category: "organization",
  },
  {
    key: "organizationEmail",
    label: "Organization Email",
    description: "Contact email for the organization",
    example: "info@sunrise-gymnastics.com",
    category: "organization",
  },
  {
    key: "organizationPhone",
    label: "Organization Phone",
    description: "Contact phone for the organization",
    example: "(555) 987-6543",
    category: "organization",
  },
  {
    key: "organizationAddress",
    label: "Organization Address",
    description: "Physical address of the organization",
    example: "123 Gym Street, Sunnyvale, CA 94086",
    category: "organization",
  },
  {
    key: "websiteUrl",
    label: "Website URL",
    description: "Organization's website URL",
    example: "https://sunrise-gymnastics.uplifterinc.com",
    category: "organization",
  },

  // Date placeholders
  {
    key: "currentDate",
    label: "Current Date",
    description: "Today's date",
    example: "February 3, 2026",
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

/**
 * Get all valid placeholder keys
 */
export function getAllPlaceholderKeys(): string[] {
  return PLACEHOLDER_DEFINITIONS.map((p) => p.key);
}

/**
 * Get placeholders by category
 */
export function getPlaceholdersByCategory(category: PlaceholderCategory): PlaceholderDefinition[] {
  return PLACEHOLDER_DEFINITIONS.filter((p) => p.category === category);
}

/**
 * Get placeholders available for a specific trigger type
 */
export function getPlaceholdersForTrigger(triggerType: NotificationTriggerType): PlaceholderDefinition[] {
  // Organization and date placeholders are always available
  const baseCategories: PlaceholderCategory[] = ["organization", "date"];
  
  // Determine which additional categories are relevant based on trigger type
  const additionalCategories: PlaceholderCategory[] = [];
  
  switch (triggerType) {
    case "MEMBERSHIP_EXPIRY":
    case "MEMBERSHIP_EXPIRED":
      additionalCategories.push("athlete", "family", "guardian", "membership");
      break;
      
    case "PAYMENT_DUE":
    case "PAYMENT_OVERDUE":
    case "PAYMENT_RECEIVED":
      additionalCategories.push("family", "guardian", "payment");
      break;
      
    case "PROGRAM_REMINDER":
    case "PROGRAM_ENROLLMENT":
    case "PROGRAM_CANCELLATION":
      additionalCategories.push("athlete", "family", "program");
      break;
      
    case "EVENT_REMINDER":
    case "EVENT_REGISTRATION_OPEN":
    case "EVENT_REGISTRATION_CLOSE":
      additionalCategories.push("athlete", "family", "guardian", "event");
      break;
      
    case "ATTENDANCE_MISSED":
    case "SKILL_ACHIEVED":
    case "EVALUATION_DUE":
    case "EVALUATION_COMPLETED":
      additionalCategories.push("athlete", "family", "program");
      break;
      
    case "BIRTHDAY":
      additionalCategories.push("athlete", "family", "guardian");
      break;
      
    case "WAITLIST_OPENING":
      additionalCategories.push("athlete", "family", "guardian", "program", "event");
      break;
      
    case "CONTRACT_RENEWAL":
    case "MAKEUP_CLASS_EXPIRING":
      additionalCategories.push("athlete", "family", "guardian", "program");
      break;
      
    case "CUSTOM":
      // All placeholders available for custom triggers
      return PLACEHOLDER_DEFINITIONS;
      
    default:
      additionalCategories.push("athlete", "family", "guardian");
  }
  
  const allCategories = [...baseCategories, ...additionalCategories];
  return PLACEHOLDER_DEFINITIONS.filter((p) => allCategories.includes(p.category));
}

// ============================================
// Template Rendering
// ============================================

/**
 * Extract all placeholder keys from a template string
 */
export function extractPlaceholders(template: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const matches: string[] = [];
  let match;
  
  while ((match = regex.exec(template)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1]);
    }
  }
  
  return matches;
}

/**
 * Render a template with the given context
 */
export function renderTemplate(template: string, context: TemplateContext): RenderResult {
  const usedPlaceholders: string[] = [];
  const missingPlaceholders: string[] = [];
  
  // Find all placeholders in the template
  const placeholdersInTemplate = extractPlaceholders(template);
  
  // Replace placeholders with values
  let rendered = template;
  for (const key of placeholdersInTemplate) {
    const value = context[key as keyof TemplateContext];
    
    if (value !== undefined && value !== null) {
      rendered = rendered.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, "g"),
        String(value)
      );
      usedPlaceholders.push(key);
    } else {
      missingPlaceholders.push(key);
      // Leave placeholder as-is for missing values (or replace with empty)
      rendered = rendered.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, "g"),
        ""
      );
    }
  }
  
  return {
    rendered,
    missingPlaceholders,
    usedPlaceholders,
  };
}

/**
 * Render a template with example values (for preview)
 */
export function renderTemplatePreview(template: string): string {
  const placeholdersInTemplate = extractPlaceholders(template);
  let rendered = template;
  
  for (const key of placeholdersInTemplate) {
    const definition = PLACEHOLDER_DEFINITIONS.find((p) => p.key === key);
    const exampleValue = definition?.example || `[${key}]`;
    
    rendered = rendered.replace(
      new RegExp(`\\{\\{${key}\\}\\}`, "g"),
      exampleValue
    );
  }
  
  return rendered;
}

// ============================================
// Template Validation
// ============================================

/**
 * Validate a template for a specific trigger type
 */
export function validateTemplate(
  template: string,
  triggerType: NotificationTriggerType
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Extract placeholders from template
  const usedPlaceholders = extractPlaceholders(template);
  
  // Get valid placeholders for this trigger type
  const validPlaceholders = getPlaceholdersForTrigger(triggerType);
  const validKeys = validPlaceholders.map((p) => p.key);
  const allValidKeys = getAllPlaceholderKeys();
  
  // Check for unknown placeholders
  const unknownPlaceholders: string[] = [];
  for (const key of usedPlaceholders) {
    if (!allValidKeys.includes(key)) {
      unknownPlaceholders.push(key);
      errors.push(`Unknown placeholder: {{${key}}}`);
    } else if (!validKeys.includes(key)) {
      warnings.push(
        `Placeholder {{${key}}} may not have a value for trigger type "${triggerType}"`
      );
    }
  }
  
  // Check for empty template
  if (!template.trim()) {
    errors.push("Template cannot be empty");
  }
  
  // Check for unclosed placeholders
  const unclosedMatches = template.match(/\{\{[^}]*$/g);
  if (unclosedMatches) {
    errors.push("Template contains unclosed placeholder brackets");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    usedPlaceholders,
    unknownPlaceholders,
  };
}

/**
 * Get a summary of placeholder categories used in a template
 */
export function getTemplatePlaceholderSummary(template: string): Record<PlaceholderCategory, string[]> {
  const usedPlaceholders = extractPlaceholders(template);
  const summary: Record<PlaceholderCategory, string[]> = {
    athlete: [],
    family: [],
    guardian: [],
    membership: [],
    program: [],
    event: [],
    payment: [],
    organization: [],
    date: [],
  };
  
  for (const key of usedPlaceholders) {
    const definition = PLACEHOLDER_DEFINITIONS.find((p) => p.key === key);
    if (definition) {
      summary[definition.category].push(key);
    }
  }
  
  return summary;
}

// ============================================
// Default Templates
// ============================================

export interface DefaultTemplate {
  triggerType: NotificationTriggerType;
  name: string;
  subject: string;
  body: string;
  smsBody: string;
}

/**
 * Default templates for system notification types
 */
export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    triggerType: "PAYMENT_DUE",
    name: "Payment Reminder",
    subject: "Payment Reminder - {{invoiceReference}}",
    body: `Dear {{primaryContact}},

This is a friendly reminder that payment of {{invoiceAmount}} for {{invoiceDescription}} is due on {{dueDate}}.

Invoice Reference: {{invoiceReference}}
Amount Due: {{invoiceAmount}}
Due Date: {{dueDate}}

To make a payment, please visit: {{paymentUrl}}

If you have already made this payment, please disregard this notice.

Thank you,
{{organizationName}}`,
    smsBody: `{{organizationName}}: Payment of {{invoiceAmount}} ({{invoiceReference}}) is due {{dueDate}}. Pay now: {{paymentUrl}}`,
  },
  {
    triggerType: "PAYMENT_OVERDUE",
    name: "Payment Reminder Urgent",
    subject: "URGENT: Payment Overdue - {{invoiceReference}}",
    body: `Dear {{primaryContact}},

This is an urgent reminder that payment of {{invoiceAmount}} for {{invoiceDescription}} is now overdue.

Invoice Reference: {{invoiceReference}}
Amount Due: {{invoiceAmount}}
Original Due Date: {{dueDate}}

Please make payment immediately to avoid any service interruptions: {{paymentUrl}}

If you need to discuss payment options, please contact us at {{organizationEmail}}.

Thank you,
{{organizationName}}`,
    smsBody: `URGENT from {{organizationName}}: Payment of {{invoiceAmount}} is overdue. Please pay now: {{paymentUrl}}`,
  },
  {
    triggerType: "MEMBERSHIP_EXPIRY",
    name: "Membership Expiry Warning",
    subject: "Your Membership is Expiring Soon - {{athleteName}}",
    body: `Dear {{primaryContact}},

This is a reminder that {{athleteName}}'s {{membershipName}} will expire on {{membershipEndDate}}.

Membership: {{membershipName}}
Athlete: {{athleteName}}
Expiration Date: {{membershipEndDate}}
Days Remaining: {{membershipDaysRemaining}}

To ensure uninterrupted participation, please renew the membership before it expires.

If you have any questions, please contact us at {{organizationEmail}}.

Thank you,
{{organizationName}}`,
    smsBody: `{{organizationName}}: {{athleteName}}'s {{membershipName}} expires {{membershipEndDate}}. Please renew to continue participation.`,
  },
  {
    triggerType: "MEMBERSHIP_EXPIRED",
    name: "Membership Expiry Urgent",
    subject: "URGENT: Membership Expired - {{athleteName}}",
    body: `Dear {{primaryContact}},

This is an urgent notice that {{athleteName}}'s {{membershipName}} has expired.

Membership: {{membershipName}}
Athlete: {{athleteName}}
Expired On: {{membershipEndDate}}

{{athleteName}} will not be able to participate in programs until the membership is renewed.

Please renew as soon as possible to avoid any disruption. Contact us at {{organizationEmail}} if you need assistance.

Thank you,
{{organizationName}}`,
    smsBody: `URGENT from {{organizationName}}: {{athleteName}}'s membership has EXPIRED. Please renew immediately to continue participation.`,
  },
  {
    triggerType: "PROGRAM_REMINDER",
    name: "Program Reminder",
    subject: "Reminder: {{programName}} - {{eventDate}}",
    body: `Dear {{primaryContact}},

This is a reminder that {{athleteName}} has {{programName}} coming up.

Program: {{programName}}
Date: {{eventDate}}
Time: {{eventTime}}
Location: {{eventLocation}}

Please ensure {{athleteFirstName}} arrives on time and has all necessary equipment.

See you soon!
{{organizationName}}`,
    smsBody: `{{organizationName}}: Reminder - {{athleteFirstName}} has {{programName}} on {{eventDate}} at {{eventTime}}.`,
  },
];

/**
 * Get the default template for a trigger type
 */
export function getDefaultTemplate(triggerType: NotificationTriggerType): DefaultTemplate | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.triggerType === triggerType);
}
