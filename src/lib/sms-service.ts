import { db } from "@/lib/db";
import {
  sendSms,
  calculateSegments,
  normalizePhoneNumber,
  isValidE164,
  mapTwilioStatus,
  isTwilioConfigured,
} from "@/lib/twilio";
import type { SmsClassification, SmsStatus, SmsCampaignStatus, AnnouncementScope } from "@prisma/client";

/**
 * SMS Service
 *
 * High-level service for sending SMS messages with:
 * - Usage tracking and billing
 * - Plan limit enforcement
 * - Campaign management
 * - Opt-out handling
 */

// ============================================
// Types
// ============================================

export interface SendSingleSmsParams {
  organizationId: string;
  to: string;
  body: string;
  classification?: SmsClassification;
  familyId?: string;
  staffProfileId?: string;
  campaignId?: string;
}

export interface SendSingleSmsResult {
  success: boolean;
  messageId?: string;
  twilioSid?: string;
  error?: string;
  errorCode?: string;
}

export interface SendCampaignParams {
  organizationId: string;
  name: string;
  body: string;
  classification?: SmsClassification;
  targetScope: AnnouncementScope;
  targetProgramId?: string;
  targetEventId?: string;
  createdById?: string;
  scheduledAt?: Date;
}

export interface SendCampaignResult {
  success: boolean;
  campaignId?: string;
  totalRecipients?: number;
  error?: string;
}

export interface UsageLimitResult {
  allowed: boolean;
  remaining: number;
  used: number;
  included: number;
  overageRate: number | null;
  error?: string;
}

export interface UsageStats {
  periodStart: Date;
  periodEnd: Date;
  messagesSent: number;
  messagesDelivered: number;
  messagesFailed: number;
  totalSegments: number;
  totalCost: number;
  includedMessages: number;
  overageMessages: number;
  overageCost: number;
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
 * Get or create usage record for current period
 */
export async function getOrCreateUsageRecord(organizationId: string) {
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

  const smsIncluded = org?.subscription?.plan?.smsIncluded ?? 0;

  // Try to find existing record
  let usage = await db.smsUsage.findUnique({
    where: {
      organizationId_periodStart: {
        organizationId,
        periodStart: start,
      },
    },
  });

  // Create if doesn't exist
  if (!usage) {
    usage = await db.smsUsage.create({
      data: {
        organizationId,
        periodStart: start,
        periodEnd: end,
        includedMessages: smsIncluded,
      },
    });
  }

  return usage;
}

/**
 * Check if organization can send more SMS messages
 */
export async function checkUsageLimits(
  organizationId: string,
  messageCount: number = 1
): Promise<UsageLimitResult> {
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

  // If no plan or SMS not included, check if they have overage enabled
  if (!plan?.smsIncluded) {
    // Allow if they have overage rate set (pay-per-use)
    if (plan?.smsOverageRate) {
      return {
        allowed: true,
        remaining: Infinity,
        used: 0,
        included: 0,
        overageRate: Number(plan.smsOverageRate),
      };
    }

    return {
      allowed: false,
      remaining: 0,
      used: 0,
      included: 0,
      overageRate: null,
      error: "SMS is not included in your plan",
    };
  }

  // Get current usage
  const usage = await getOrCreateUsageRecord(organizationId);
  const used = usage.messagesSent;
  const included = plan.smsIncluded;
  const remaining = Math.max(0, included - used);
  const overageRate = plan.smsOverageRate ? Number(plan.smsOverageRate) : null;

  // Check if within limits or overage is allowed
  if (used + messageCount <= included) {
    return {
      allowed: true,
      remaining: remaining - messageCount,
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
    error: `SMS limit reached. You've used ${used} of ${included} messages this month.`,
  };
}

/**
 * Record SMS usage after sending
 */
export async function recordUsage(
  organizationId: string,
  segments: number,
  cost: number = 0
): Promise<void> {
  const usage = await getOrCreateUsageRecord(organizationId);

  // Get plan limits
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    include: {
      subscription: {
        include: { plan: true },
      },
    },
  });

  const included = org?.subscription?.plan?.smsIncluded ?? 0;
  const overageRate = org?.subscription?.plan?.smsOverageRate
    ? Number(org.subscription.plan.smsOverageRate)
    : 0;

  // Calculate overage
  const newSent = usage.messagesSent + 1;
  const newOverage = Math.max(0, newSent - included);
  const overageCost = newOverage * overageRate;

  await db.smsUsage.update({
    where: { id: usage.id },
    data: {
      messagesSent: { increment: 1 },
      totalSegments: { increment: segments },
      totalCost: { increment: cost },
      overageMessages: newOverage,
      overageCost,
    },
  });
}

/**
 * Update usage on delivery/failure
 */
export async function updateUsageOnDelivery(
  organizationId: string,
  delivered: boolean
): Promise<void> {
  const usage = await getOrCreateUsageRecord(organizationId);

  if (delivered) {
    await db.smsUsage.update({
      where: { id: usage.id },
      data: {
        messagesDelivered: { increment: 1 },
      },
    });
  } else {
    await db.smsUsage.update({
      where: { id: usage.id },
      data: {
        messagesFailed: { increment: 1 },
      },
    });
  }
}

/**
 * Get usage statistics for an organization
 */
export async function getUsageStats(organizationId: string): Promise<UsageStats | null> {
  const usage = await getOrCreateUsageRecord(organizationId);

  return {
    periodStart: usage.periodStart,
    periodEnd: usage.periodEnd,
    messagesSent: usage.messagesSent,
    messagesDelivered: usage.messagesDelivered,
    messagesFailed: usage.messagesFailed,
    totalSegments: usage.totalSegments,
    totalCost: Number(usage.totalCost),
    includedMessages: usage.includedMessages,
    overageMessages: usage.overageMessages,
    overageCost: Number(usage.overageCost),
  };
}

// ============================================
// Sending SMS
// ============================================

/**
 * Send a single SMS message
 */
export async function sendSingleSms(
  params: SendSingleSmsParams
): Promise<SendSingleSmsResult> {
  const {
    organizationId,
    to,
    body,
    classification = "GENERAL",
    familyId,
    staffProfileId,
    campaignId,
  } = params;

  // Check if Twilio is configured
  if (!isTwilioConfigured()) {
    return {
      success: false,
      error: "SMS service is not configured",
      errorCode: "NOT_CONFIGURED",
    };
  }

  // Validate phone number
  const normalizedPhone = normalizePhoneNumber(to);
  if (!isValidE164(normalizedPhone)) {
    return {
      success: false,
      error: "Invalid phone number format",
      errorCode: "INVALID_PHONE",
    };
  }

  // Check opt-out status if family is specified
  if (familyId) {
    const family = await db.family.findUnique({
      where: { id: familyId },
      select: { smsOptOut: true },
    });

    if (family?.smsOptOut) {
      return {
        success: false,
        error: "Recipient has opted out of SMS messages",
        errorCode: "OPTED_OUT",
      };
    }
  }

  // Check usage limits
  const limits = await checkUsageLimits(organizationId);
  if (!limits.allowed) {
    return {
      success: false,
      error: limits.error || "SMS limit reached",
      errorCode: "LIMIT_REACHED",
    };
  }

  // Calculate segments
  const segments = calculateSegments(body);

  // Create message record first (for tracking)
  const smsMessage = await db.smsMessage.create({
    data: {
      organizationId,
      familyId,
      staffProfileId,
      campaignId,
      to: normalizedPhone,
      from: process.env.TWILIO_PHONE_NUMBER || "",
      body,
      segments,
      classification,
      direction: "OUTBOUND",
      twilioStatus: "QUEUED",
    },
  });

  // Send via Twilio
  const result = await sendSms({
    to: normalizedPhone,
    body,
    organizationId,
    campaignId,
  });

  if (result.success && result.sid) {
    // Update message with Twilio SID
    await db.smsMessage.update({
      where: { id: smsMessage.id },
      data: {
        twilioSid: result.sid,
        twilioStatus: mapTwilioStatus(result.status || "queued"),
        sentAt: new Date(),
      },
    });

    // Record usage
    await recordUsage(organizationId, segments);

    return {
      success: true,
      messageId: smsMessage.id,
      twilioSid: result.sid,
    };
  } else {
    // Update message with error
    await db.smsMessage.update({
      where: { id: smsMessage.id },
      data: {
        twilioStatus: "FAILED",
        failedAt: new Date(),
        errorCode: result.errorCode,
        errorMessage: result.error,
      },
    });

    return {
      success: false,
      messageId: smsMessage.id,
      error: result.error,
      errorCode: result.errorCode,
    };
  }
}

/**
 * Get phone numbers for a campaign target
 */
async function getCampaignRecipients(
  organizationId: string,
  targetScope: AnnouncementScope,
  targetProgramId?: string,
  targetEventId?: string
): Promise<Array<{ familyId: string; phone: string }>> {
  let whereClause: any = {
    organizationId,
    smsOptOut: false,
    phone: { not: "" },
  };

  if (targetScope === "PROGRAM" && targetProgramId) {
    // Get families with athletes enrolled in the program
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
                family: true,
              },
            },
          },
        },
      },
    });

    const familyIds = new Set<string>();
    enrollments.forEach((e) => {
      e.athlete.guardians.forEach((g) => {
        if (g.family.phone && !g.family.smsOptOut) {
          familyIds.add(g.familyId);
        }
      });
    });

    whereClause = {
      ...whereClause,
      id: { in: Array.from(familyIds) },
    };
  } else if (targetScope === "EVENT" && targetEventId) {
    // Get families with athletes registered for the event
    const attendances = await db.attendance.findMany({
      where: {
        eventId: targetEventId,
      },
      include: {
        athlete: {
          include: {
            guardians: {
              include: {
                family: true,
              },
            },
          },
        },
      },
    });

    const familyIds = new Set<string>();
    attendances.forEach((a) => {
      a.athlete.guardians.forEach((g) => {
        if (g.family.phone && !g.family.smsOptOut) {
          familyIds.add(g.familyId);
        }
      });
    });

    whereClause = {
      ...whereClause,
      id: { in: Array.from(familyIds) },
    };
  }

  const families = await db.family.findMany({
    where: whereClause,
    select: {
      id: true,
      phone: true,
    },
  });

  return families.map((f) => ({ familyId: f.id, phone: f.phone }));
}

/**
 * Create and optionally send an SMS campaign
 */
export async function createCampaign(
  params: SendCampaignParams
): Promise<SendCampaignResult> {
  const {
    organizationId,
    name,
    body,
    classification = "GENERAL",
    targetScope,
    targetProgramId,
    targetEventId,
    createdById,
    scheduledAt,
  } = params;

  // Check if Twilio is configured
  if (!isTwilioConfigured()) {
    return {
      success: false,
      error: "SMS service is not configured",
    };
  }

  // Get recipients
  const recipients = await getCampaignRecipients(
    organizationId,
    targetScope,
    targetProgramId,
    targetEventId
  );

  if (recipients.length === 0) {
    return {
      success: false,
      error: "No valid recipients found for this campaign",
    };
  }

  // Check usage limits for all messages
  const limits = await checkUsageLimits(organizationId, recipients.length);
  if (!limits.allowed) {
    return {
      success: false,
      error: limits.error || "SMS limit reached",
    };
  }

  // Create campaign
  const campaign = await db.smsCampaign.create({
    data: {
      organizationId,
      name,
      body,
      classification,
      targetScope,
      targetProgramId,
      targetEventId,
      totalRecipients: recipients.length,
      createdById,
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
      scheduledAt,
    },
  });

  // If not scheduled, start sending immediately
  if (!scheduledAt) {
    await executeCampaign(campaign.id);
  }

  return {
    success: true,
    campaignId: campaign.id,
    totalRecipients: recipients.length,
  };
}

/**
 * Execute a campaign (send all messages)
 */
export async function executeCampaign(campaignId: string): Promise<void> {
  const campaign = await db.smsCampaign.findUnique({
    where: { id: campaignId },
    include: { organization: true },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  // Update status to sending
  await db.smsCampaign.update({
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
    campaign.targetEventId ?? undefined
  );

  let sentCount = 0;
  let failedCount = 0;

  // Send to each recipient
  for (const recipient of recipients) {
    const result = await sendSingleSms({
      organizationId: campaign.organizationId,
      to: recipient.phone,
      body: campaign.body,
      classification: campaign.classification,
      familyId: recipient.familyId,
      campaignId,
    });

    if (result.success) {
      sentCount++;
    } else {
      failedCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Update campaign status
  await db.smsCampaign.update({
    where: { id: campaignId },
    data: {
      status: failedCount === recipients.length ? "FAILED" : "COMPLETED",
      sentCount,
      failedCount,
      completedAt: new Date(),
    },
  });
}

// ============================================
// Webhook Handlers
// ============================================

/**
 * Handle Twilio status callback webhook
 */
export async function handleStatusCallback(params: {
  MessageSid: string;
  MessageStatus: string;
  ErrorCode?: string;
  ErrorMessage?: string;
  Price?: string;
  PriceUnit?: string;
}): Promise<void> {
  const { MessageSid, MessageStatus, ErrorCode, ErrorMessage, Price } = params;

  // Find message by Twilio SID
  const message = await db.smsMessage.findUnique({
    where: { twilioSid: MessageSid },
  });

  if (!message) {
    console.warn(`Received webhook for unknown message SID: ${MessageSid}`);
    return;
  }

  const status = mapTwilioStatus(MessageStatus);
  const cost = Price ? Math.abs(parseFloat(Price)) : undefined;

  // Update message status
  const updateData: any = {
    twilioStatus: status,
  };

  if (status === "DELIVERED") {
    updateData.deliveredAt = new Date();
    await updateUsageOnDelivery(message.organizationId, true);
  } else if (status === "FAILED" || status === "UNDELIVERED") {
    updateData.failedAt = new Date();
    updateData.errorCode = ErrorCode;
    updateData.errorMessage = ErrorMessage;
    await updateUsageOnDelivery(message.organizationId, false);
  }

  if (cost !== undefined) {
    updateData.cost = cost;
  }

  await db.smsMessage.update({
    where: { id: message.id },
    data: updateData,
  });

  // Update campaign stats if part of a campaign
  if (message.campaignId) {
    if (status === "DELIVERED") {
      await db.smsCampaign.update({
        where: { id: message.campaignId },
        data: {
          deliveredCount: { increment: 1 },
        },
      });
    } else if (status === "FAILED" || status === "UNDELIVERED") {
      await db.smsCampaign.update({
        where: { id: message.campaignId },
        data: {
          failedCount: { increment: 1 },
        },
      });
    }
  }
}

/**
 * Handle inbound SMS
 *
 * Processes all inbound messages:
 * 1. Handles opt-out/opt-in keywords
 * 2. Routes ALL messages to conversations (including opt-out messages)
 */
export async function handleInboundSms(params: {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
}): Promise<void> {
  const { From, To, Body, MessageSid } = params;
  const normalizedFrom = normalizePhoneNumber(From);
  const bodyUpper = Body.trim().toUpperCase();

  // Check for opt-out keywords
  const optOutKeywords = ["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
  const optInKeywords = ["START", "YES", "UNSTOP"];

  const isOptOut = optOutKeywords.includes(bodyUpper);
  const isOptIn = optInKeywords.includes(bodyUpper);

  // Process opt-out/opt-in
  if (isOptOut || isOptIn) {
    // Build phone variants for flexible matching (phone may be stored without country code)
    const digitsOnly = normalizedFrom.replace(/\D/g, "");
    const withoutCountryCode = digitsOnly.startsWith("1") && digitsOnly.length === 11
      ? digitsOnly.substring(1)
      : digitsOnly;
    const phoneVariants = [normalizedFrom, digitsOnly, withoutCountryCode];

    const families = await db.family.findMany({
      where: { phone: { in: phoneVariants } },
    });

    for (const family of families) {
      await db.family.update({
        where: { id: family.id },
        data: {
          smsOptOut: isOptOut,
          smsOptOutAt: isOptOut ? new Date() : null,
        },
      });
    }
  }

  // Route ALL inbound messages to conversations
  const { routeInboundMessage } = await import("@/lib/sms-conversation-service");
  await routeInboundMessage({
    from: From,
    to: To,
    body: Body,
    twilioSid: MessageSid,
  });
}
