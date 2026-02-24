import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import type {
  EmailClassification,
  EmailStatus,
  EmailCampaignStatus,
  AnnouncementScope,
  EmailTargetType,
} from "@prisma/client";

/**
 * Email Campaign Service
 *
 * High-level service for sending email campaigns with:
 * - Usage tracking and billing
 * - Plan limit enforcement
 * - Campaign management
 * - Opt-out handling
 * - Open/click tracking support
 */

// ============================================
// Types
// ============================================

export interface SendSingleEmailParams {
  organizationId: string;
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  classification?: EmailClassification;
  userId?: string;
  campaignId?: string;
}

export interface SendSingleEmailResult {
  success: boolean;
  messageId?: string;
  sesMessageId?: string;
  error?: string;
  errorCode?: string;
}

export interface CreateCampaignParams {
  organizationId: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  classification?: EmailClassification;
  targetScope: AnnouncementScope;
  targetProgramId?: string;
  targetEventId?: string;
  targetMembershipStatus?: "ACTIVE" | "EXPIRED";
  createdById?: string;
  scheduledAt?: Date;
  sendImmediately?: boolean;
}

export interface CreateCampaignResult {
  success: boolean;
  campaignId?: string;
  totalRecipients?: number;
  error?: string;
}

export interface EmailUsageLimitResult {
  allowed: boolean;
  remaining: number;
  used: number;
  included: number;
  overageRate: number | null;
  error?: string;
}

export interface EmailUsageStats {
  periodStart: Date;
  periodEnd: Date;
  emailsSent: number;
  emailsDelivered: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsBounced: number;
  emailsComplained: number;
  emailsFailed: number;
  includedEmails: number;
  overageEmails: number;
  overageCost: number;
}

export interface EmailRecipient {
  userId?: string;
  email: string;
  name: string;
}

// ============================================
// Usage & Billing
// ============================================

/**
 * Get the current billing period dates
 */
export function getCurrentBillingPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Get or create email usage record for current period
 */
export async function getOrCreateEmailUsageRecord(organizationId: string) {
  const { start, end } = getCurrentBillingPeriod();

  // Get organization's plan limits
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    include: {
      subscription: {
        include: { plan: true },
      },
    },
  });

  const emailIncluded = org?.subscription?.plan?.emailIncluded ?? 0;

  // Try to find existing record
  let usage = await db.emailUsage.findUnique({
    where: {
      organizationId_periodStart: {
        organizationId,
        periodStart: start,
      },
    },
  });

  // Create if doesn't exist
  if (!usage) {
    usage = await db.emailUsage.create({
      data: {
        organizationId,
        periodStart: start,
        periodEnd: end,
        includedEmails: emailIncluded,
      },
    });
  }

  return usage;
}

/**
 * Check if organization can send more emails
 */
export async function checkEmailUsageLimits(
  organizationId: string,
  emailCount: number = 1
): Promise<EmailUsageLimitResult> {
  // Get organization with subscription plan
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    include: {
      subscription: {
        include: { plan: true },
      },
    },
  });

  if (!org) {
    return {
      allowed: false,
      remaining: 0,
      used: 0,
      included: 0,
      overageRate: null,
      error: "Organization not found",
    };
  }

  const plan = org.subscription?.plan;

  // If no plan or emails not included, check if they have overage enabled
  if (!plan?.emailIncluded) {
    // Allow if they have overage rate set (pay-per-use)
    if (plan?.emailOverageRate) {
      return {
        allowed: true,
        remaining: Infinity,
        used: 0,
        included: 0,
        overageRate: Number(plan.emailOverageRate),
      };
    }

    return {
      allowed: false,
      remaining: 0,
      used: 0,
      included: 0,
      overageRate: null,
      error: "Email campaigns are not included in your plan",
    };
  }

  // Get current usage
  const usage = await getOrCreateEmailUsageRecord(organizationId);
  const used = usage.emailsSent;
  const included = plan.emailIncluded;
  const remaining = Math.max(0, included - used);
  const overageRate = plan.emailOverageRate ? Number(plan.emailOverageRate) : null;

  // Check if within limits or overage is allowed
  if (used + emailCount <= included) {
    return {
      allowed: true,
      remaining: remaining - emailCount,
      used,
      included,
      overageRate,
    };
  }

  // Over limit - check if overage is allowed
  if (overageRate !== null) {
    return {
      allowed: true,
      remaining: 0,
      used,
      included,
      overageRate,
    };
  }

  return {
    allowed: false,
    remaining,
    used,
    included,
    overageRate: null,
    error: `Email limit reached. You've used ${used} of ${included} emails this month.`,
  };
}

/**
 * Record email usage after sending
 */
export async function recordEmailUsage(organizationId: string): Promise<void> {
  const usage = await getOrCreateEmailUsageRecord(organizationId);

  // Get plan limits
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    include: {
      subscription: {
        include: { plan: true },
      },
    },
  });

  const included = org?.subscription?.plan?.emailIncluded ?? 0;
  const overageRate = org?.subscription?.plan?.emailOverageRate
    ? Number(org.subscription.plan.emailOverageRate)
    : 0;

  // Calculate overage
  const newSent = usage.emailsSent + 1;
  const newOverage = Math.max(0, newSent - included);
  const overageCost = newOverage * overageRate;

  await db.emailUsage.update({
    where: { id: usage.id },
    data: {
      emailsSent: { increment: 1 },
      overageEmails: newOverage,
      overageCost,
    },
  });
}

/**
 * Update usage on delivery status change
 */
export async function updateEmailUsageOnStatus(
  organizationId: string,
  status: "delivered" | "opened" | "clicked" | "bounced" | "complained" | "failed"
): Promise<void> {
  const usage = await getOrCreateEmailUsageRecord(organizationId);

  const updateField = {
    delivered: "emailsDelivered",
    opened: "emailsOpened",
    clicked: "emailsClicked",
    bounced: "emailsBounced",
    complained: "emailsComplained",
    failed: "emailsFailed",
  }[status];

  await db.emailUsage.update({
    where: { id: usage.id },
    data: {
      [updateField]: { increment: 1 },
    },
  });
}

/**
 * Get email usage statistics for an organization
 */
export async function getEmailUsageStats(organizationId: string): Promise<EmailUsageStats | null> {
  const usage = await getOrCreateEmailUsageRecord(organizationId);

  return {
    periodStart: usage.periodStart,
    periodEnd: usage.periodEnd,
    emailsSent: usage.emailsSent,
    emailsDelivered: usage.emailsDelivered,
    emailsOpened: usage.emailsOpened,
    emailsClicked: usage.emailsClicked,
    emailsBounced: usage.emailsBounced,
    emailsComplained: usage.emailsComplained,
    emailsFailed: usage.emailsFailed,
    includedEmails: usage.includedEmails,
    overageEmails: usage.overageEmails,
    overageCost: Number(usage.overageCost),
  };
}

// ============================================
// Recipient Selection
// ============================================

export interface ExpandedTargetingParams {
  organizationId: string;
  targetType: EmailTargetType;
  targetProgramId?: string;
  targetEventId?: string;
  targetMembershipStatus?: "ACTIVE" | "EXPIRED";
  targetProgramInstanceId?: string;
  targetMembershipGroupIds?: string[];
  targetUserIds?: string[];
}

/**
 * Get email recipients for a campaign target (legacy - kept for backward compat)
 */
export async function getCampaignRecipients(
  organizationId: string,
  targetScope: AnnouncementScope,
  targetProgramId?: string,
  targetEventId?: string,
  targetMembershipStatus?: "ACTIVE" | "EXPIRED"
): Promise<EmailRecipient[]> {
  // Map legacy scope to new target type
  const targetTypeMap: Record<string, EmailTargetType> = {
    ALL: "ALL_MEMBERS",
    PROGRAM: "PROGRAM_ANY_INSTANCE",
    EVENT: "ALL_MEMBERS", // Events will be handled via legacy path
    GUARDIAN: "ALL_GUARDIANS",
  };

  return getExpandedCampaignRecipients({
    organizationId,
    targetType: targetTypeMap[targetScope] || "ALL_MEMBERS",
    targetProgramId,
    targetEventId: targetScope === "EVENT" ? targetEventId : undefined,
    targetMembershipStatus,
  });
}

/**
 * Get email recipients using expanded targeting (new 8-category system)
 */
export async function getExpandedCampaignRecipients(
  params: ExpandedTargetingParams
): Promise<EmailRecipient[]> {
  const {
    organizationId,
    targetType,
    targetProgramId,
    targetEventId,
    targetMembershipStatus,
    targetProgramInstanceId,
    targetMembershipGroupIds,
    targetUserIds,
  } = params;

  const recipients: EmailRecipient[] = [];
  const seenEmails = new Set<string>();

  const addUser = (user: { id: string; email: string; name: string; emailOptOut?: boolean }) => {
    if (user.emailOptOut) return;
    if (user.email && !seenEmails.has(user.email.toLowerCase())) {
      seenEmails.add(user.email.toLowerCase());
      recipients.push({
        userId: user.id,
        email: user.email,
        name: user.name,
      });
    }
  };

  switch (targetType) {
    case "ALL_USERS": {
      const members = await db.organizationMember.findMany({
        where: {
          organizationId,
          status: "ACTIVE",
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              status: true,
              emailOptOut: true,
            },
          },
        },
      });

      members.forEach((m) => {
        if (m.user.status === "ACTIVE") {
          addUser({ id: m.user.id, email: m.user.email, name: m.user.name, emailOptOut: m.user.emailOptOut });
        }
      });
      break;
    }

    case "ALL_MEMBERS":
    case "ALL_GUARDIANS": {
      const users = await db.user.findMany({
        where: {
          emailOptOut: false,
          email: { not: "" },
          athleteGuardians: {
            some: {
              athlete: { organizationAthletes: { some: { organizationId } } },
            },
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          emailOptOut: true,
        },
      });

      users.forEach((u) => {
        addUser({ id: u.id, email: u.email, name: u.name, emailOptOut: u.emailOptOut });
      });
      break;
    }

    case "ALL_PROGRAM_REGISTRANTS": {
      // All families/guardians with at least one active enrollment in any program
      const enrollments = await db.enrollment.findMany({
        where: {
          status: "ACTIVE",
          athlete: {
            organizationAthletes: { some: { organizationId } },
          },
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
                      name: true,
                      emailOptOut: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      enrollments.forEach((e) => {
        e.athlete.guardians.forEach((g) => {
          if (g.user?.email) {
            addUser({ id: g.user.id, email: g.user.email, name: g.user.name, emailOptOut: g.user.emailOptOut });
          }
        });
      });
      break;
    }

    case "PROGRAM_ANY_INSTANCE": {
      if (!targetProgramId) break;

      // Families/guardians via InstanceRegistration for ANY instance of the given program
      const registrations = await db.instanceRegistration.findMany({
        where: {
          programInstance: {
            programId: targetProgramId,
          },
          status: { in: ["REGISTERED", "ATTENDED"] },
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
                      name: true,
                      emailOptOut: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      registrations.forEach((r) => {
        r.athlete.guardians.forEach((g) => {
          if (g.user?.email) {
            addUser({ id: g.user.id, email: g.user.email, name: g.user.name, emailOptOut: g.user.emailOptOut });
          }
        });
      });

      // Also include legacy Enrollment-based registrations
      const enrollments = await db.enrollment.findMany({
        where: {
          programId: targetProgramId,
          status: "ACTIVE",
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
                      name: true,
                      emailOptOut: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      enrollments.forEach((e) => {
        e.athlete.guardians.forEach((g) => {
          if (g.user?.email) {
            addUser({ id: g.user.id, email: g.user.email, name: g.user.name, emailOptOut: g.user.emailOptOut });
          }
        });
      });
      break;
    }

    case "PROGRAM_SPECIFIC_INSTANCE": {
      if (!targetProgramInstanceId) break;

      // Families/guardians via InstanceRegistration for a SPECIFIC program instance
      const registrations = await db.instanceRegistration.findMany({
        where: {
          programInstanceId: targetProgramInstanceId,
          status: { in: ["REGISTERED", "ATTENDED"] },
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
                      name: true,
                      emailOptOut: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      registrations.forEach((r) => {
        r.athlete.guardians.forEach((g) => {
          if (g.user?.email) {
            addUser({ id: g.user.id, email: g.user.email, name: g.user.name, emailOptOut: g.user.emailOptOut });
          }
        });
      });
      break;
    }

    case "MEMBERSHIP_HOLDERS": {
      if (!targetMembershipGroupIds?.length) break;

      // Families/guardians with athletes holding memberships in the specified group(s)
      const memberships = await db.athleteMembership.findMany({
        where: {
          status: "ACTIVE",
          instance: {
            membershipGroupId: { in: targetMembershipGroupIds },
          },
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
                      name: true,
                      emailOptOut: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      memberships.forEach((m) => {
        m.athlete.guardians.forEach((g) => {
          if (g.user?.email) {
            addUser({ id: g.user.id, email: g.user.email, name: g.user.name, emailOptOut: g.user.emailOptOut });
          }
        });
      });
      break;
    }

    case "SPECIFIC_USERS": {
      if (targetUserIds?.length) {
        const users = await db.user.findMany({
          where: {
            id: { in: targetUserIds },
            status: "ACTIVE",
          },
          select: {
            id: true,
            email: true,
            name: true,
            emailOptOut: true,
          },
        });
        users.forEach((u) => {
          if (u.email) addUser({ id: u.id, email: u.email, name: u.name, emailOptOut: u.emailOptOut });
        });
      }
      break;
    }
  }

  // Handle legacy event targeting
  if (targetEventId) {
    const attendances = await db.attendance.findMany({
      where: {
        eventId: targetEventId,
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
                    name: true,
                    emailOptOut: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const eventRecipients: EmailRecipient[] = [];
    const eventSeenEmails = new Set<string>();

    attendances.forEach((a) => {
      a.athlete.guardians.forEach((g) => {
        if (g.user?.email && !g.user.emailOptOut && !eventSeenEmails.has(g.user.email.toLowerCase())) {
          eventSeenEmails.add(g.user.email.toLowerCase());
          eventRecipients.push({
            userId: g.user.id,
            email: g.user.email,
            name: g.user.name,
          });
        }
      });
    });

    return eventRecipients;
  }

  // Additional filtering by membership status if specified
  if (targetMembershipStatus && recipients.length > 0 && targetType !== "MEMBERSHIP_HOLDERS") {
    const userIds = recipients.filter((r) => r.userId).map((r) => r.userId!);

    if (userIds.length === 0) return recipients;

    const usersWithGuardians = await db.athleteGuardian.findMany({
      where: {
        userId: { in: userIds },
      },
      include: {
        athlete: {
          include: {
            memberships: {
              orderBy: { endDate: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    const validUserIds = new Set<string>();
    const now = new Date();

    const guardiansByUserId = new Map<string, typeof usersWithGuardians>();
    usersWithGuardians.forEach((g) => {
      if (!g.userId) return;
      const existing = guardiansByUserId.get(g.userId) || [];
      existing.push(g);
      guardiansByUserId.set(g.userId, existing);
    });

    guardiansByUserId.forEach((guardians, uId) => {
      const hasAthleteWithStatus = guardians.some((g) => {
        const membership = g.athlete.memberships[0];
        if (!membership) {
          return targetMembershipStatus === "EXPIRED";
        }
        const isActive = membership.endDate && membership.endDate > now;
        return targetMembershipStatus === "ACTIVE" ? isActive : !isActive;
      });

      if (hasAthleteWithStatus) {
        validUserIds.add(uId);
      }
    });

    return recipients.filter((r) => !r.userId || validUserIds.has(r.userId));
  }

  return recipients;
}

// ============================================
// Sending Emails
// ============================================

/**
 * Send a single email
 */
export async function sendSingleEmail(
  params: SendSingleEmailParams
): Promise<SendSingleEmailResult> {
  const {
    organizationId,
    to,
    subject,
    htmlBody,
    textBody,
    classification = "GENERAL",
    userId,
    campaignId,
  } = params;

  // Validate email
  if (!to || !to.includes("@")) {
    return {
      success: false,
      error: "Invalid email address",
      errorCode: "INVALID_EMAIL",
    };
  }

  // Check opt-out status
  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { emailOptOut: true },
    });

    if (user?.emailOptOut) {
      return {
        success: false,
        error: "Recipient has opted out of marketing emails",
        errorCode: "OPTED_OUT",
      };
    }
  }

  // Check usage limits
  const limits = await checkEmailUsageLimits(organizationId);
  if (!limits.allowed) {
    return {
      success: false,
      error: limits.error || "Email limit reached",
      errorCode: "LIMIT_REACHED",
    };
  }

  // Get organization for from email
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, email: true },
  });

  const fromEmail = org?.email || process.env.AWS_SES_FROM_EMAIL || "noreply@uplifterinc.com";

  // Create message record first (for tracking)
  const emailMessage = await db.emailMessage.create({
    data: {
      organizationId,
      userId,
      campaignId,
      to,
      from: fromEmail,
      subject,
      htmlBody,
      textBody,
      classification,
      status: "QUEUED",
    },
  });

  // Send via email service (SES or MailHog)
  const result = await sendEmail({
    to: [to],
    subject,
    html: htmlBody,
    text: textBody,
    from: fromEmail,
  });

  if (result.success && result.messageId) {
    // Update message with SES message ID
    await db.emailMessage.update({
      where: { id: emailMessage.id },
      data: {
        sesMessageId: result.messageId,
        status: "SENT",
        sentAt: new Date(),
      },
    });

    // Record usage
    await recordEmailUsage(organizationId);

    return {
      success: true,
      messageId: emailMessage.id,
      sesMessageId: result.messageId,
    };
  } else {
    // Update message with error
    await db.emailMessage.update({
      where: { id: emailMessage.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        errorMessage: result.error,
      },
    });

    return {
      success: false,
      messageId: emailMessage.id,
      error: result.error,
    };
  }
}

/**
 * Create and optionally send an email campaign
 */
export async function createEmailCampaign(
  params: CreateCampaignParams
): Promise<CreateCampaignResult> {
  const {
    organizationId,
    name,
    subject,
    htmlBody,
    textBody,
    classification = "GENERAL",
    targetScope,
    targetProgramId,
    targetEventId,
    targetMembershipStatus,
    createdById,
    scheduledAt,
    sendImmediately = false,
  } = params;

  // Get recipients
  const recipients = await getCampaignRecipients(
    organizationId,
    targetScope,
    targetProgramId,
    targetEventId,
    targetMembershipStatus
  );

  if (recipients.length === 0) {
    return {
      success: false,
      error: "No valid recipients found for this campaign",
    };
  }

  // Check usage limits for all messages
  const limits = await checkEmailUsageLimits(organizationId, recipients.length);
  if (!limits.allowed) {
    return {
      success: false,
      error: limits.error || "Email limit reached",
    };
  }

  // Create campaign
  const campaign = await db.emailCampaign.create({
    data: {
      organizationId,
      name,
      subject,
      htmlBody,
      textBody,
      classification,
      targetScope,
      targetProgramId,
      targetEventId,
      targetMembershipStatus,
      totalRecipients: recipients.length,
      createdById,
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
      scheduledAt,
    },
  });

  // If sendImmediately, start sending
  if (sendImmediately && !scheduledAt) {
    // Execute in background (don't await to return quickly)
    executeEmailCampaign(campaign.id).catch(console.error);
  }

  return {
    success: true,
    campaignId: campaign.id,
    totalRecipients: recipients.length,
  };
}

/**
 * Build template context for a specific recipient
 */
async function buildRecipientContext(
  organizationId: string,
  userId?: string
): Promise<Record<string, string>> {
  const context: Record<string, string> = {};

  // Organization context
  const org = await db.organization.findUnique({
    where: { id: organizationId },
  });
  if (org) {
    context.organizationName = org.name;
    if (org.email) context.organizationEmail = org.email;
    if (org.phone) context.organizationPhone = org.phone;
    const addressParts = [org.street, org.city, org.stateProvince, org.postalCode].filter(Boolean);
    if (addressParts.length > 0) context.organizationAddress = addressParts.join(", ");
  }

  // Date context
  const now = new Date();
  context.currentDate = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  context.currentYear = now.getFullYear().toString();

  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        athleteGuardians: {
          include: {
            athlete: {
              include: {
                organizationAthletes: {
                  where: { organizationId },
                  select: { level: true },
                },
                memberships: {
                  where: { status: "ACTIVE" },
                  include: { instance: { include: { group: true } } },
                  take: 1,
                },
                enrollments: {
                  where: { status: "ACTIVE" },
                  include: { program: true },
                  take: 1,
                },
              },
            },
          },
          take: 1,
        },
      },
    });
    if (user) {
      context.guardianName = user.name;
      context.guardianFirstName = user.name.split(" ")[0];
      context.guardianEmail = user.email;
      context.guardianPhone = user.phone || "";
      context.guardianBalance = `$${Number(user.balance).toFixed(2)}`;
      const athlete = user.athleteGuardians[0]?.athlete;
      if (athlete) {
        context.athleteName = athlete.name;
        const nameParts = athlete.name.split(" ");
        context.athleteFirstName = nameParts[0];
        if (nameParts.length > 1) context.athleteLastName = nameParts.slice(1).join(" ");
        if (athlete.email) context.athleteEmail = athlete.email;
        const oaLevel = athlete.organizationAthletes?.[0]?.level;
        if (oaLevel) context.athleteLevel = oaLevel;
        const membership = athlete.memberships?.[0];
        if (membership) {
          context.membershipName = membership.instance.name;
          context.membershipGroupName = membership.instance.group.name;
          context.membershipStartDate = membership.startDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
          if (membership.endDate) {
            context.membershipEndDate = membership.endDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
            const daysRemaining = Math.ceil((membership.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            context.membershipDaysRemaining = daysRemaining.toString();
          }
          context.membershipStatus = membership.status;
          context.membershipPrice = `$${Number(membership.instance.price).toFixed(2)}`;
        }
        const enrollment = athlete.enrollments?.[0];
        if (enrollment) {
          context.programName = enrollment.program.name;
          if (enrollment.program.description) context.programDescription = enrollment.program.description;
        }
      }
    }
    return context;
  }

  return context;
}

/**
 * Render placeholders in a template string using a context map
 */
function renderPlaceholders(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return context[key] || "";
  });
}

/**
 * Execute an email campaign (send all messages)
 */
export async function executeEmailCampaign(campaignId: string): Promise<void> {
  const campaign = await db.emailCampaign.findUnique({
    where: { id: campaignId },
    include: { organization: true },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
    throw new Error(`Cannot execute campaign with status: ${campaign.status}`);
  }

  // Update status to sending
  await db.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: "SENDING",
      startedAt: new Date(),
    },
  });

  // Get recipients using expanded targeting
  const recipients = await getExpandedCampaignRecipients({
    organizationId: campaign.organizationId,
    targetType: campaign.targetType,
    targetProgramId: campaign.targetProgramId ?? undefined,
    targetEventId: campaign.targetEventId ?? undefined,
    targetMembershipStatus: campaign.targetMembershipStatus as "ACTIVE" | "EXPIRED" | undefined,
    targetProgramInstanceId: campaign.targetProgramInstanceId ?? undefined,
    targetMembershipGroupIds: campaign.targetMembershipGroupIds,
    targetUserIds: campaign.targetUserIds,
  });

  let sentCount = 0;
  let failedCount = 0;

  // Send to each recipient with per-recipient placeholder rendering
  for (const recipient of recipients) {
    const context = recipient.userId
      ? await buildRecipientContext(campaign.organizationId, recipient.userId)
      : {
            organizationName: campaign.organization.name,
            currentDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
            currentYear: new Date().getFullYear().toString(),
          };

    // Render placeholders in subject and body
    const personalizedSubject = renderPlaceholders(campaign.subject, context);
    const personalizedHtml = renderPlaceholders(campaign.htmlBody, context);
    const personalizedText = campaign.textBody
      ? renderPlaceholders(campaign.textBody, context)
      : undefined;

    const result = await sendSingleEmail({
      organizationId: campaign.organizationId,
      to: recipient.email,
      subject: personalizedSubject,
      htmlBody: personalizedHtml,
      textBody: personalizedText,
      classification: campaign.classification,
      userId: recipient.userId,
      campaignId,
    });

    if (result.success) {
      sentCount++;
    } else {
      failedCount++;
    }

    // Small delay to avoid rate limiting (SES has rate limits)
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Update campaign status
  await db.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: failedCount === recipients.length ? "FAILED" : "COMPLETED",
      sentCount,
      failedCount,
      completedAt: new Date(),
    },
  });
}

/**
 * Cancel a scheduled or draft campaign
 */
export async function cancelEmailCampaign(campaignId: string): Promise<boolean> {
  const campaign = await db.emailCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    return false;
  }

  if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
    return false;
  }

  await db.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: "CANCELLED",
    },
  });

  return true;
}

// ============================================
// Webhook Handlers (for SES notifications)
// ============================================

/**
 * Handle SES delivery notification
 */
export async function handleEmailDelivery(sesMessageId: string): Promise<void> {
  const message = await db.emailMessage.findUnique({
    where: { sesMessageId },
  });

  if (!message) {
    console.warn(`Received delivery notification for unknown message: ${sesMessageId}`);
    return;
  }

  await db.emailMessage.update({
    where: { id: message.id },
    data: {
      status: "DELIVERED",
      deliveredAt: new Date(),
    },
  });

  await updateEmailUsageOnStatus(message.organizationId, "delivered");

  // Update campaign stats
  if (message.campaignId) {
    await db.emailCampaign.update({
      where: { id: message.campaignId },
      data: {
        deliveredCount: { increment: 1 },
      },
    });
  }
}

/**
 * Handle SES bounce notification
 */
export async function handleEmailBounce(
  sesMessageId: string,
  bounceType: string,
  bounceSubType: string
): Promise<void> {
  const message = await db.emailMessage.findUnique({
    where: { sesMessageId },
  });

  if (!message) {
    console.warn(`Received bounce notification for unknown message: ${sesMessageId}`);
    return;
  }

  await db.emailMessage.update({
    where: { id: message.id },
    data: {
      status: "BOUNCED",
      bouncedAt: new Date(),
      bounceType,
      bounceSubType,
    },
  });

  await updateEmailUsageOnStatus(message.organizationId, "bounced");

  // Update campaign stats
  if (message.campaignId) {
    await db.emailCampaign.update({
      where: { id: message.campaignId },
      data: {
        bouncedCount: { increment: 1 },
      },
    });
  }

  if (bounceType === "Permanent" && message.userId) {
    await db.user.update({
      where: { id: message.userId },
      data: {
        emailOptOut: true,
        emailOptOutAt: new Date(),
      },
    });
  }
}

/**
 * Handle SES complaint notification
 */
export async function handleEmailComplaint(sesMessageId: string): Promise<void> {
  const message = await db.emailMessage.findUnique({
    where: { sesMessageId },
  });

  if (!message) {
    console.warn(`Received complaint notification for unknown message: ${sesMessageId}`);
    return;
  }

  await db.emailMessage.update({
    where: { id: message.id },
    data: {
      status: "COMPLAINED",
      complainedAt: new Date(),
    },
  });

  await updateEmailUsageOnStatus(message.organizationId, "complained");

  // Update campaign stats
  if (message.campaignId) {
    await db.emailCampaign.update({
      where: { id: message.campaignId },
      data: {
        complainedCount: { increment: 1 },
      },
    });
  }

  if (message.userId) {
    await db.user.update({
      where: { id: message.userId },
      data: {
        emailOptOut: true,
        emailOptOutAt: new Date(),
      },
    });
  }
}

/**
 * Handle email open tracking
 */
export async function handleEmailOpen(sesMessageId: string): Promise<void> {
  const message = await db.emailMessage.findUnique({
    where: { sesMessageId },
  });

  if (!message) {
    return;
  }

  // Only count first open for unique opens
  const isFirstOpen = !message.openedAt;

  await db.emailMessage.update({
    where: { id: message.id },
    data: {
      status: message.status === "DELIVERED" ? "OPENED" : message.status,
      openedAt: message.openedAt || new Date(),
      openCount: { increment: 1 },
    },
  });

  if (isFirstOpen) {
    await updateEmailUsageOnStatus(message.organizationId, "opened");

    // Update campaign stats
    if (message.campaignId) {
      await db.emailCampaign.update({
        where: { id: message.campaignId },
        data: {
          openedCount: { increment: 1 },
        },
      });
    }
  }
}

/**
 * Handle email click tracking
 */
export async function handleEmailClick(sesMessageId: string): Promise<void> {
  const message = await db.emailMessage.findUnique({
    where: { sesMessageId },
  });

  if (!message) {
    return;
  }

  // Only count first click for unique clicks
  const isFirstClick = !message.clickedAt;

  await db.emailMessage.update({
    where: { id: message.id },
    data: {
      status: "CLICKED",
      clickedAt: message.clickedAt || new Date(),
      clickCount: { increment: 1 },
    },
  });

  if (isFirstClick) {
    await updateEmailUsageOnStatus(message.organizationId, "clicked");

    // Update campaign stats
    if (message.campaignId) {
      await db.emailCampaign.update({
        where: { id: message.campaignId },
        data: {
          clickedCount: { increment: 1 },
        },
      });
    }
  }
}

/**
 * Handle unsubscribe request
 */
export async function handleUnsubscribe(
  identifier: string,
): Promise<void> {
  await db.user.update({
    where: { id: identifier },
    data: {
      emailOptOut: true,
      emailOptOutAt: new Date(),
    },
  });
}
