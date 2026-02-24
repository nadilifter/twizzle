/**
 * Notification Service
 * 
 * Core service for the notification rules system. Handles:
 * - Recipient selection based on filters
 * - Action execution (Email, SMS, Announcement)
 * - Notification logging
 * - System rule management
 */

import { db } from "@/lib/db";
import { sendSingleSms } from "@/lib/sms-service";
import { sendSingleEmail } from "@/lib/email-campaign-service";
import {
  renderTemplate,
  getDefaultTemplate,
  type TemplateContext,
} from "@/lib/notification-template-service";
import { getSubdomainUrl } from "@/lib/env-domains";
import type {
  NotificationRule,
  NotificationTemplate,
  NotificationRecipientConfig,
  NotificationTriggerType,
  NotificationActionType,
  NotificationRecipientType,
  NotificationLogStatus,
  Athlete,
  User,
  Organization,
} from "@prisma/client";

// ============================================
// Types
// ============================================

export interface RecipientFilters {
  programIds?: string[];
  membershipGroupIds?: string[];
  membershipStatuses?: string[];
  athleteStatuses?: string[];
  userRoles?: string[];
  includeInactive?: boolean;
}

export interface NotificationRecipient {
  type: "athlete" | "user";
  id: string;
  email?: string;
  phone?: string;
  name: string;
  athleteId?: string;
  userId?: string;
}

export interface ExecuteNotificationParams {
  ruleId: string;
  athleteId?: string;
  userId?: string;
  membershipId?: string;
  programId?: string;
  eventId?: string;
  invoiceId?: string;
  recipientOverride?: NotificationRecipient[];
}

export interface ExecuteNotificationResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  logIds: string[];
  errors: string[];
}

export interface CreateSystemRulesResult {
  created: number;
  existing: number;
  rules: NotificationRule[];
}

// Type for rule with relations
type RuleWithRelations = NotificationRule & {
  template: NotificationTemplate | null;
  recipientConfig: NotificationRecipientConfig | null;
  organization: Organization;
};

// ============================================
// System Rules
// ============================================

/**
 * System notification rules that every organization must have
 */
const SYSTEM_RULES: Array<{
  triggerType: NotificationTriggerType;
  name: string;
  description: string;
  timingValue: number;
  timingUnit: "DAYS" | "WEEKS" | "MONTHS";
  timingDirection: "BEFORE" | "AFTER" | "AT";
  actionType: NotificationActionType;
  recipientType: NotificationRecipientType;
}> = [
  {
    triggerType: "PAYMENT_DUE",
    name: "Payment Reminder",
    description: "Reminder sent 3 days before payment is due",
    timingValue: 3,
    timingUnit: "DAYS",
    timingDirection: "BEFORE",
    actionType: "EMAIL",
    recipientType: "ALL_GUARDIANS",
  },
  {
    triggerType: "PAYMENT_OVERDUE",
    name: "Payment Reminder Urgent",
    description: "Urgent reminder sent 1 day after payment is overdue",
    timingValue: 1,
    timingUnit: "DAYS",
    timingDirection: "AFTER",
    actionType: "EMAIL",
    recipientType: "ALL_GUARDIANS",
  },
  {
    triggerType: "MEMBERSHIP_EXPIRY",
    name: "Membership Expiry Warning",
    description: "Warning sent 7 days before membership expires",
    timingValue: 7,
    timingUnit: "DAYS",
    timingDirection: "BEFORE",
    actionType: "EMAIL",
    recipientType: "MEMBERSHIP_HOLDERS",
  },
  {
    triggerType: "MEMBERSHIP_EXPIRED",
    name: "Membership Expiry Urgent",
    description: "Urgent notice sent 1 day after membership expires",
    timingValue: 1,
    timingUnit: "DAYS",
    timingDirection: "AFTER",
    actionType: "EMAIL",
    recipientType: "MEMBERSHIP_HOLDERS",
  },
  {
    triggerType: "PROGRAM_REMINDER",
    name: "Program Reminder",
    description: "Reminder sent 1 day before class/event",
    timingValue: 1,
    timingUnit: "DAYS",
    timingDirection: "BEFORE",
    actionType: "EMAIL",
    recipientType: "PROGRAM_MEMBERS",
  },
];

/**
 * Create system notification rules for an organization
 * Called when organization is created or to ensure rules exist
 */
export async function createSystemRulesForOrganization(
  organizationId: string
): Promise<CreateSystemRulesResult> {
  const result: CreateSystemRulesResult = {
    created: 0,
    existing: 0,
    rules: [],
  };

  for (const systemRule of SYSTEM_RULES) {
    // Check if rule already exists
    const existingRule = await db.notificationRule.findFirst({
      where: {
        organizationId,
        triggerType: systemRule.triggerType,
        isSystem: true,
        name: systemRule.name,
      },
    });

    if (existingRule) {
      result.existing++;
      result.rules.push(existingRule);
      continue;
    }

    // Get default template for this trigger type
    const defaultTemplate = getDefaultTemplate(systemRule.triggerType);

    // Create the rule with template and recipient config
    const rule = await db.notificationRule.create({
      data: {
        organizationId,
        name: systemRule.name,
        description: systemRule.description,
        triggerType: systemRule.triggerType,
        timingValue: systemRule.timingValue,
        timingUnit: systemRule.timingUnit,
        timingDirection: systemRule.timingDirection,
        actionType: systemRule.actionType,
        isSystem: true,
        isActive: true,
        template: defaultTemplate
          ? {
              create: {
                subject: defaultTemplate.subject,
                body: defaultTemplate.body,
                smsBody: defaultTemplate.smsBody,
              },
            }
          : undefined,
        recipientConfig: {
          create: {
            recipientType: systemRule.recipientType,
            filters: {},
          },
        },
      },
    });

    result.created++;
    result.rules.push(rule);
  }

  return result;
}

/**
 * Check if organization has all system rules
 */
export async function hasAllSystemRules(organizationId: string): Promise<boolean> {
  const count = await db.notificationRule.count({
    where: {
      organizationId,
      isSystem: true,
    },
  });

  return count >= SYSTEM_RULES.length;
}

// ============================================
// Recipient Selection
// ============================================

/**
 * Get recipients based on recipient config
 */
export async function getRecipients(
  organizationId: string,
  recipientType: NotificationRecipientType,
  filters: RecipientFilters = {},
  contextData?: {
    athleteId?: string;
    userId?: string;
    programId?: string;
    eventId?: string;
  }
): Promise<NotificationRecipient[]> {
  const recipients: NotificationRecipient[] = [];
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();

  // Helper to add a user/guardian recipient
  const addGuardianUser = (user: {
    id: string;
    email: string;
    phone: string | null;
    name: string;
    smsOptOut?: boolean;
    emailOptOut?: boolean;
  }) => {
    if (user.email && !seenEmails.has(user.email.toLowerCase())) {
      seenEmails.add(user.email.toLowerCase());
    }
    if (user.phone && !seenPhones.has(user.phone)) {
      seenPhones.add(user.phone);
    }
    recipients.push({
      type: "user",
      id: user.id,
      email: user.emailOptOut ? undefined : user.email,
      phone: user.smsOptOut ? undefined : (user.phone || undefined),
      name: user.name,
      userId: user.id,
    });
  };

  // Helper to add a user recipient
  const addUser = (user: { id: string; email: string; name: string }) => {
    if (!seenEmails.has(user.email.toLowerCase())) {
      seenEmails.add(user.email.toLowerCase());
      recipients.push({
        type: "user",
        id: user.id,
        email: user.email,
        name: user.name,
        userId: user.id,
      });
    }
  };

  switch (recipientType) {
    case "ALL_GUARDIANS": {
      // Resolve guardian Users via AthleteGuardian relationships
      const guardianLinks = await db.athleteGuardian.findMany({
        where: {
          athlete: { organizationAthletes: { some: { organizationId } } },
          userId: { not: null },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              name: true,
              smsOptOut: true,
              emailOptOut: true,
            },
          },
        },
      });

      for (const link of guardianLinks) {
        if (link.user?.email) {
          addGuardianUser({
            id: link.user.id,
            email: link.user.email,
            phone: link.user.phone,
            name: link.user.name,
            smsOptOut: link.user.smsOptOut,
            emailOptOut: link.user.emailOptOut,
          });
        }
      }
      break;
    }

    case "ALL_ATHLETES": {
      const athletes = await db.athlete.findMany({
        where: {
          organizationAthletes: { some: { organizationId } },
          ...(filters.athleteStatuses?.length
            ? { status: { in: filters.athleteStatuses as any } }
            : {}),
        },
        include: {
          guardians: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  phone: true,
                  name: true,
                  smsOptOut: true,
                  emailOptOut: true,
                },
              },
            },
          },
        },
      });

      for (const athlete of athletes) {
        for (const guardian of athlete.guardians) {
          if (guardian.userId && guardian.user?.email) {
            addGuardianUser({
              id: guardian.user.id,
              email: guardian.user.email,
              phone: guardian.user.phone,
              name: guardian.user.name,
              smsOptOut: guardian.user.smsOptOut,
              emailOptOut: guardian.user.emailOptOut,
            });
          }
        }
      }
      break;
    }

    case "PROGRAM_MEMBERS": {
      // Get families of athletes enrolled in specific programs
      const programIds = filters.programIds?.length
        ? filters.programIds
        : contextData?.programId
          ? [contextData.programId]
          : [];

      const enrollmentWhere = programIds.length === 0
        ? { program: { organizationId }, status: "ACTIVE" as const }
        : { programId: { in: programIds }, status: "ACTIVE" as const };

      const enrollments = await db.enrollment.findMany({
        where: enrollmentWhere,
        include: {
          athlete: {
            include: {
              guardians: {
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      phone: true,
                      name: true,
                      smsOptOut: true,
                      emailOptOut: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      for (const enrollment of enrollments) {
        for (const guardian of enrollment.athlete.guardians) {
          if (guardian.userId && guardian.user?.email) {
            addGuardianUser({
              id: guardian.user.id,
              email: guardian.user.email,
              phone: guardian.user.phone,
              name: guardian.user.name,
              smsOptOut: guardian.user.smsOptOut,
              emailOptOut: guardian.user.emailOptOut,
            });
          }
        }
      }
      break;
    }

    case "MEMBERSHIP_HOLDERS": {
      const membershipGroupIds = filters.membershipGroupIds || [];
      const membershipStatuses = filters.membershipStatuses || ["ACTIVE"];

      const memberships = await db.athleteMembership.findMany({
        where: {
          status: { in: membershipStatuses as any },
          ...(membershipGroupIds.length
            ? {
                instance: {
                  group: { id: { in: membershipGroupIds } },
                },
              }
            : {}),
          athlete: { organizationAthletes: { some: { organizationId } } },
        },
        include: {
          athlete: {
            include: {
              guardians: {
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      phone: true,
                      name: true,
                      smsOptOut: true,
                      emailOptOut: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      for (const membership of memberships) {
        for (const guardian of membership.athlete.guardians) {
          if (guardian.userId && guardian.user?.email) {
            addGuardianUser({
              id: guardian.user.id,
              email: guardian.user.email,
              phone: guardian.user.phone,
              name: guardian.user.name,
              smsOptOut: guardian.user.smsOptOut,
              emailOptOut: guardian.user.emailOptOut,
            });
          }
        }
      }
      break;
    }

    case "INTERNAL_USERS": {
      // Get internal staff/admin users
      const userRoles = filters.userRoles || ["ADMIN", "COACH", "STAFF"];

      const members = await db.organizationMember.findMany({
        where: {
          organizationId,
          role: { in: userRoles as any },
          status: "ACTIVE",
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      for (const member of members) {
        addUser(member.user);
      }
      break;
    }

    case "CUSTOM": {
      if (contextData?.userId) {
        const user = await db.user.findUnique({
          where: { id: contextData.userId },
          select: {
            id: true,
            email: true,
            phone: true,
            name: true,
            smsOptOut: true,
            emailOptOut: true,
          },
        });
        if (user?.email) {
          addGuardianUser(user);
        }
      } else if (contextData?.athleteId) {
        const athlete = await db.athlete.findUnique({
          where: { id: contextData.athleteId },
          include: {
            guardians: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    phone: true,
                    name: true,
                    smsOptOut: true,
                    emailOptOut: true,
                  },
                },
              },
            },
          },
        });
        if (athlete) {
          for (const guardian of athlete.guardians) {
            if (guardian.userId && guardian.user?.email) {
              addGuardianUser({
                id: guardian.user.id,
                email: guardian.user.email,
                phone: guardian.user.phone,
                name: guardian.user.name,
                smsOptOut: guardian.user.smsOptOut,
                emailOptOut: guardian.user.emailOptOut,
              });
            }
          }
        }
      }
      break;
    }
  }

  return recipients;
}

// ============================================
// Context Building
// ============================================

/**
 * Build template context from various entities
 */
export async function buildTemplateContext(
  organizationId: string,
  data: {
    athleteId?: string;
    userId?: string;
    membershipId?: string;
    programId?: string;
    eventId?: string;
    invoiceId?: string;
  }
): Promise<TemplateContext> {
  const context: TemplateContext = {};

  // Get organization
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    include: {
      websiteConfig: true,
    },
  });

  if (org) {
    context.organizationName = org.name;
    context.organizationEmail = org.email || undefined;
    context.organizationPhone = org.phone || undefined;
    context.organizationAddress = [org.street, org.city, org.stateProvince, org.postalCode]
      .filter(Boolean)
      .join(", ") || undefined;
    context.websiteUrl = org.websiteConfig?.subdomain
      ? getSubdomainUrl(org.websiteConfig.subdomain)
      : undefined;
  }

  // Get athlete
  if (data.athleteId) {
    const athlete = await db.athlete.findUnique({
      where: { id: data.athleteId },
      include: {
        organizationAthletes: organizationId
          ? { where: { organizationId }, select: { level: true } }
          : { select: { level: true }, take: 1 },
      },
    });
    if (athlete) {
      context.athleteName = athlete.name;
      const nameParts = athlete.name.split(" ");
      context.athleteFirstName = nameParts[0];
      context.athleteLastName = nameParts.slice(1).join(" ") || undefined;
      context.athleteEmail = athlete.email || undefined;
      const orgAthleteLevel = athlete.organizationAthletes[0]?.level;
      context.athleteLevel = orgAthleteLevel || undefined;
      
      if (athlete.birthDate) {
        context.athleteBirthDate = formatDate(athlete.birthDate);
        context.athleteAge = calculateAge(athlete.birthDate);
      }
    }
  }

  // Get guardian user (primary path for User-based context)
  if (data.userId) {
    const user = await db.user.findUnique({
      where: { id: data.userId },
    });
    if (user) {
      context.guardianName = user.name;
      context.guardianFirstName = user.name.split(" ")[0];
      context.guardianEmail = user.email;
      context.guardianPhone = user.phone || undefined;
      context.guardianBalance = formatCurrency(Number(user.balance));
    }
  }

  // Get membership
  if (data.membershipId) {
    const membership = await db.athleteMembership.findUnique({
      where: { id: data.membershipId },
      include: {
        instance: {
          include: {
            group: true,
          },
        },
      },
    });
    if (membership) {
      context.membershipName = membership.instance.name;
      context.membershipGroupName = membership.instance.group.name;
      context.membershipStartDate = formatDate(membership.startDate);
      if (membership.endDate) {
        context.membershipEndDate = formatDate(membership.endDate);
        context.membershipDaysRemaining = calculateDaysUntil(membership.endDate);
      }
      context.membershipStatus = membership.status;
      context.membershipPrice = formatCurrency(Number(membership.instance.price));
    }
  }

  // Get program
  if (data.programId) {
    const program = await db.program.findUnique({
      where: { id: data.programId },
    });
    if (program) {
      context.programName = program.name;
      context.programDescription = program.description || undefined;
    }
  }

  // Get event
  if (data.eventId) {
    const event = await db.event.findUnique({
      where: { id: data.eventId },
      include: {
        facility: true,
      },
    });
    if (event) {
      context.eventName = event.title;
      context.eventDate = formatDate(event.date);
      context.eventTime = event.startTime;
      context.eventLocation = event.facility?.name || "TBD";
      context.eventDescription = event.description || undefined;
    }
  }

  // Get invoice
  if (data.invoiceId) {
    const invoice = await db.invoice.findUnique({
      where: { id: data.invoiceId },
      include: {
        lineItems: true,
      },
    });
    if (invoice) {
      context.invoiceAmount = formatCurrency(Number(invoice.total));
      context.invoiceReference = invoice.reference;
      context.invoiceDescription = invoice.lineItems.map((li) => li.description).join(", ");
      context.dueDate = formatDate(invoice.dueDate);
      context.dueDaysRemaining = calculateDaysUntil(invoice.dueDate);
      context.balanceDue = formatCurrency(Number(invoice.total));
      // Payment URL - uses environment-aware subdomain
      context.paymentUrl = `${getSubdomainUrl('pay')}/inv/${invoice.id}`;
    }
  }

  // Date context
  context.currentDate = formatDate(new Date());
  context.currentYear = new Date().getFullYear().toString();

  return context;
}

// ============================================
// Action Execution
// ============================================

/**
 * Execute a notification rule
 */
export async function executeNotification(
  params: ExecuteNotificationParams
): Promise<ExecuteNotificationResult> {
  const result: ExecuteNotificationResult = {
    success: true,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    logIds: [],
    errors: [],
  };

  // Get the rule with template and recipient config
  const rule = await db.notificationRule.findUnique({
    where: { id: params.ruleId },
    include: {
      template: true,
      recipientConfig: true,
      organization: true,
    },
  });

  if (!rule) {
    result.success = false;
    result.errors.push("Notification rule not found");
    return result;
  }

  if (!rule.isActive) {
    result.success = false;
    result.errors.push("Notification rule is not active");
    return result;
  }

  if (!rule.template) {
    result.success = false;
    result.errors.push("Notification rule has no template");
    return result;
  }

  // Get recipients
  const recipients = params.recipientOverride || await getRecipients(
    rule.organizationId,
    rule.recipientConfig?.recipientType || "ALL_GUARDIANS",
    (rule.recipientConfig?.filters as RecipientFilters) || {},
    {
      athleteId: params.athleteId,
      userId: params.userId,
      programId: params.programId,
      eventId: params.eventId,
    }
  );

  if (recipients.length === 0) {
    result.skippedCount = 0;
    return result;
  }

  // Build base context
  const baseContext = await buildTemplateContext(rule.organizationId, {
    athleteId: params.athleteId,
    userId: params.userId,
    membershipId: params.membershipId,
    programId: params.programId,
    eventId: params.eventId,
    invoiceId: params.invoiceId,
  });

  // Execute for each recipient
  for (const recipient of recipients) {
    // Build recipient-specific context
    const context: TemplateContext = { ...baseContext };
    
    if (recipient.userId && !context.guardianName) {
      const user = await db.user.findUnique({
        where: { id: recipient.userId },
      });
      if (user) {
        context.guardianName = user.name;
        context.guardianFirstName = user.name.split(" ")[0];
        context.guardianEmail = user.email;
        context.guardianPhone = user.phone || undefined;
        context.guardianBalance = formatCurrency(Number(user.balance));
      }
    }

    // Render template
    const subjectResult = rule.template.subject
      ? renderTemplate(rule.template.subject, context)
      : { rendered: "", missingPlaceholders: [], usedPlaceholders: [] };
    
    const bodyResult = renderTemplate(rule.template.body, context);
    const smsBodyResult = rule.template.smsBody
      ? renderTemplate(rule.template.smsBody, context)
      : null;

    // Create log entry
    const log = await db.notificationLog.create({
      data: {
        organizationId: rule.organizationId,
        notificationRuleId: rule.id,
        triggerType: rule.triggerType,
        actionType: rule.actionType,
        recipientEmail: recipient.email,
        recipientPhone: recipient.phone,
        recipientName: recipient.name,
        athleteId: recipient.athleteId,
        userId: recipient.userId,
        subject: subjectResult.rendered,
        body: bodyResult.rendered,
        status: "PENDING",
      },
    });
    result.logIds.push(log.id);

    // Execute action
    try {
      let actionResult: { success: boolean; messageId?: string; error?: string } = {
        success: false,
      };

      switch (rule.actionType) {
        case "EMAIL":
          if (!recipient.email) {
            await updateLogStatus(log.id, "SKIPPED", "No email address");
            result.skippedCount++;
            continue;
          }
          actionResult = await sendSingleEmail({
            organizationId: rule.organizationId,
            to: recipient.email,
            subject: subjectResult.rendered,
            htmlBody: bodyResult.rendered,
            userId: recipient.userId,
          });
          if (actionResult.success) {
            await db.notificationLog.update({
              where: { id: log.id },
              data: {
                status: "SENT",
                emailMessageId: actionResult.messageId,
                sentAt: new Date(),
              },
            });
          }
          break;

        case "SMS":
          if (!recipient.phone) {
            await updateLogStatus(log.id, "SKIPPED", "No phone number");
            result.skippedCount++;
            continue;
          }
          const smsBody = smsBodyResult?.rendered || bodyResult.rendered.substring(0, 160);
          actionResult = await sendSingleSms({
            organizationId: rule.organizationId,
            to: recipient.phone,
            body: smsBody,
            userId: recipient.userId,
          });
          if (actionResult.success) {
            await db.notificationLog.update({
              where: { id: log.id },
              data: {
                status: "SENT",
                smsMessageId: actionResult.messageId,
                sentAt: new Date(),
              },
            });
          }
          break;

        case "ANNOUNCEMENT":
          // Create an announcement
          const announcement = await db.announcement.create({
            data: {
              organizationId: rule.organizationId,
              title: subjectResult.rendered || "Notification",
              content: bodyResult.rendered,
              targetScope: "ALL",
              status: "PUBLISHED",
              priority: "NORMAL",
              publishedAt: new Date(),
            },
          });
          await db.notificationLog.update({
            where: { id: log.id },
            data: {
              status: "SENT",
              announcementId: announcement.id,
              sentAt: new Date(),
            },
          });
          actionResult = { success: true };
          break;
      }

      if (actionResult.success) {
        result.sentCount++;
      } else {
        await updateLogStatus(log.id, "FAILED", actionResult.error);
        result.failedCount++;
        result.errors.push(actionResult.error || "Unknown error");
      }
    } catch (error: any) {
      await updateLogStatus(log.id, "FAILED", error.message);
      result.failedCount++;
      result.errors.push(error.message);
    }
  }

  result.success = result.failedCount === 0;
  return result;
}

async function updateLogStatus(
  logId: string,
  status: NotificationLogStatus,
  errorMessage?: string
): Promise<void> {
  await db.notificationLog.update({
    where: { id: logId },
    data: {
      status,
      errorMessage,
      ...(status === "SENT" ? { sentAt: new Date() } : {}),
    },
  });
}

// ============================================
// Helper Functions
// ============================================

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function calculateDaysUntil(date: Date): number {
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ============================================
// Rule CRUD Operations
// ============================================

/**
 * Get all notification rules for an organization
 */
export async function getNotificationRules(
  organizationId: string,
  options?: {
    includeInactive?: boolean;
    triggerType?: NotificationTriggerType;
  }
) {
  return db.notificationRule.findMany({
    where: {
      organizationId,
      ...(options?.includeInactive ? {} : { isActive: true }),
      ...(options?.triggerType ? { triggerType: options.triggerType } : {}),
    },
    include: {
      template: true,
      recipientConfig: true,
    },
    orderBy: [
      { isSystem: "desc" },
      { triggerType: "asc" },
      { name: "asc" },
    ],
  });
}

/**
 * Get a single notification rule
 */
export async function getNotificationRule(ruleId: string) {
  return db.notificationRule.findUnique({
    where: { id: ruleId },
    include: {
      template: true,
      recipientConfig: true,
    },
  });
}

/**
 * Create a new notification rule
 */
export async function createNotificationRule(data: {
  organizationId: string;
  name: string;
  description?: string;
  triggerType: NotificationTriggerType;
  timingValue: number;
  timingUnit: "MINUTES" | "HOURS" | "DAYS" | "WEEKS" | "MONTHS";
  timingDirection: "BEFORE" | "AFTER" | "AT";
  actionType: NotificationActionType;
  template: {
    subject?: string;
    body: string;
    smsBody?: string;
  };
  recipientConfig: {
    recipientType: NotificationRecipientType;
    filters?: RecipientFilters;
    ccEmails?: string[];
  };
}) {
  return db.notificationRule.create({
    data: {
      organizationId: data.organizationId,
      name: data.name,
      description: data.description,
      triggerType: data.triggerType,
      timingValue: data.timingValue,
      timingUnit: data.timingUnit,
      timingDirection: data.timingDirection,
      actionType: data.actionType,
      isSystem: false,
      isActive: true,
      template: {
        create: {
          subject: data.template.subject,
          body: data.template.body,
          smsBody: data.template.smsBody,
        },
      },
      recipientConfig: {
        create: {
          recipientType: data.recipientConfig.recipientType,
          filters: JSON.parse(JSON.stringify(data.recipientConfig.filters || {})),
          ccEmails: data.recipientConfig.ccEmails || [],
        },
      },
    },
    include: {
      template: true,
      recipientConfig: true,
    },
  });
}

/**
 * Update a notification rule
 */
export async function updateNotificationRule(
  ruleId: string,
  data: {
    name?: string;
    description?: string;
    timingValue?: number;
    timingUnit?: "MINUTES" | "HOURS" | "DAYS" | "WEEKS" | "MONTHS";
    timingDirection?: "BEFORE" | "AFTER" | "AT";
    actionType?: NotificationActionType;
    isActive?: boolean;
    template?: {
      subject?: string;
      body?: string;
      smsBody?: string;
    };
    recipientConfig?: {
      recipientType?: NotificationRecipientType;
      filters?: RecipientFilters;
      ccEmails?: string[];
    };
  }
) {
  // Get the current rule to check if it's a system rule
  const currentRule = await db.notificationRule.findUnique({
    where: { id: ruleId },
    include: { template: true, recipientConfig: true },
  });

  if (!currentRule) {
    throw new Error("Rule not found");
  }

  // System rules can only have certain fields updated
  const updateData: any = {};
  
  if (!currentRule.isSystem) {
    // Non-system rules can update all fields
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.timingValue !== undefined) updateData.timingValue = data.timingValue;
    if (data.timingUnit !== undefined) updateData.timingUnit = data.timingUnit;
    if (data.timingDirection !== undefined) updateData.timingDirection = data.timingDirection;
    if (data.actionType !== undefined) updateData.actionType = data.actionType;
  }
  
  // Both system and non-system can update isActive and template
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  // Update the rule
  const rule = await db.notificationRule.update({
    where: { id: ruleId },
    data: updateData,
  });

  // Update template if provided
  if (data.template && currentRule.template) {
    await db.notificationTemplate.update({
      where: { id: currentRule.template.id },
      data: {
        subject: data.template.subject,
        body: data.template.body,
        smsBody: data.template.smsBody,
      },
    });
  }

  // Update recipient config if provided (only for non-system rules)
  if (data.recipientConfig && currentRule.recipientConfig && !currentRule.isSystem) {
    await db.notificationRecipientConfig.update({
      where: { id: currentRule.recipientConfig.id },
      data: {
        recipientType: data.recipientConfig.recipientType,
        filters: data.recipientConfig.filters ? JSON.parse(JSON.stringify(data.recipientConfig.filters)) : undefined,
        ccEmails: data.recipientConfig.ccEmails,
      },
    });
  }

  return getNotificationRule(ruleId);
}

/**
 * Delete a notification rule (only non-system rules)
 */
export async function deleteNotificationRule(ruleId: string): Promise<boolean> {
  const rule = await db.notificationRule.findUnique({
    where: { id: ruleId },
  });

  if (!rule) {
    throw new Error("Rule not found");
  }

  if (rule.isSystem) {
    throw new Error("Cannot delete system notification rules");
  }

  await db.notificationRule.delete({
    where: { id: ruleId },
  });

  return true;
}

/**
 * Get notification logs for an organization
 */
export async function getNotificationLogs(
  organizationId: string,
  options?: {
    ruleId?: string;
    status?: NotificationLogStatus;
    triggerType?: NotificationTriggerType;
    limit?: number;
    offset?: number;
  }
) {
  return db.notificationLog.findMany({
    where: {
      organizationId,
      ...(options?.ruleId ? { notificationRuleId: options.ruleId } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.triggerType ? { triggerType: options.triggerType } : {}),
    },
    include: {
      notificationRule: {
        select: {
          name: true,
          actionType: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit || 50,
    skip: options?.offset || 0,
  });
}
