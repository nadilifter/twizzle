import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import type {
  EmailClassification,
  EmailStatus,
  EmailCampaignStatus,
  AnnouncementScope,
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
  familyId?: string;
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
  familyId: string;
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

/**
 * Get email recipients for a campaign target
 */
export async function getCampaignRecipients(
  organizationId: string,
  targetScope: AnnouncementScope,
  targetProgramId?: string,
  targetEventId?: string,
  targetMembershipStatus?: "ACTIVE" | "EXPIRED"
): Promise<EmailRecipient[]> {
  const recipients: EmailRecipient[] = [];
  const seenEmails = new Set<string>();

  // Helper to add a family if not already added
  const addFamily = (family: { id: string; email: string; primaryContact: string }) => {
    if (family.email && !seenEmails.has(family.email.toLowerCase())) {
      seenEmails.add(family.email.toLowerCase());
      recipients.push({
        familyId: family.id,
        email: family.email,
        name: family.primaryContact,
      });
    }
  };

  if (targetScope === "ALL") {
    // All families in organization (not opted out)
    const families = await db.family.findMany({
      where: {
        organizationId,
        emailOptOut: false,
        email: { not: "" },
      },
      select: {
        id: true,
        email: true,
        primaryContact: true,
      },
    });

    families.forEach(addFamily);
  } else if (targetScope === "PROGRAM" && targetProgramId) {
    // Families with athletes enrolled in the program
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
                family: {
                  select: {
                    id: true,
                    email: true,
                    primaryContact: true,
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
        if (!g.family.emailOptOut) {
          addFamily(g.family);
        }
      });
    });
  } else if (targetScope === "EVENT" && targetEventId) {
    // Families with athletes registered for the event
    const attendances = await db.attendance.findMany({
      where: {
        eventId: targetEventId,
      },
      include: {
        athlete: {
          include: {
            guardians: {
              include: {
                family: {
                  select: {
                    id: true,
                    email: true,
                    primaryContact: true,
                    emailOptOut: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    attendances.forEach((a) => {
      a.athlete.guardians.forEach((g) => {
        if (!g.family.emailOptOut) {
          addFamily(g.family);
        }
      });
    });
  } else if (targetScope === "FAMILY") {
    // All families (same as ALL for now, could be customized)
    const families = await db.family.findMany({
      where: {
        organizationId,
        emailOptOut: false,
        email: { not: "" },
      },
      select: {
        id: true,
        email: true,
        primaryContact: true,
      },
    });

    families.forEach(addFamily);
  }

  // Additional filtering by membership status if specified
  if (targetMembershipStatus && recipients.length > 0) {
    const familyIds = recipients.map((r) => r.familyId);
    
    // Get athletes for these families and check membership status
    const familiesWithMembership = await db.family.findMany({
      where: {
        id: { in: familyIds },
      },
      include: {
        guardians: {
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
        },
      },
    });

    const validFamilyIds = new Set<string>();
    const now = new Date();

    familiesWithMembership.forEach((family) => {
      const hasAthleteWithStatus = family.guardians.some((g) => {
        const membership = g.athlete.memberships[0];
        if (!membership) {
          return targetMembershipStatus === "EXPIRED";
        }
        const isActive = membership.endDate > now;
        return targetMembershipStatus === "ACTIVE" ? isActive : !isActive;
      });

      if (hasAthleteWithStatus) {
        validFamilyIds.add(family.id);
      }
    });

    return recipients.filter((r) => validFamilyIds.has(r.familyId));
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
    familyId,
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

  // Check opt-out status if family is specified
  if (familyId) {
    const family = await db.family.findUnique({
      where: { id: familyId },
      select: { emailOptOut: true },
    });

    if (family?.emailOptOut) {
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
      familyId,
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

  // Get recipients
  const recipients = await getCampaignRecipients(
    campaign.organizationId,
    campaign.targetScope,
    campaign.targetProgramId ?? undefined,
    campaign.targetEventId ?? undefined,
    campaign.targetMembershipStatus as "ACTIVE" | "EXPIRED" | undefined
  );

  let sentCount = 0;
  let failedCount = 0;

  // Send to each recipient
  for (const recipient of recipients) {
    const result = await sendSingleEmail({
      organizationId: campaign.organizationId,
      to: recipient.email,
      subject: campaign.subject,
      htmlBody: campaign.htmlBody,
      textBody: campaign.textBody ?? undefined,
      classification: campaign.classification,
      familyId: recipient.familyId,
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

  // If permanent bounce, opt out the family
  if (bounceType === "Permanent" && message.familyId) {
    await db.family.update({
      where: { id: message.familyId },
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

  // Opt out the family on complaint
  if (message.familyId) {
    await db.family.update({
      where: { id: message.familyId },
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
export async function handleUnsubscribe(familyId: string): Promise<void> {
  await db.family.update({
    where: { id: familyId },
    data: {
      emailOptOut: true,
      emailOptOutAt: new Date(),
    },
  });
}
