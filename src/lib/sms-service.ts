import { db } from "@/lib/db";
import {
  sendSms,
  calculateSegments,
  normalizePhoneNumber,
  isValidE164,
  mapTwilioStatus,
  isTwilioConfigured,
} from "@/lib/twilio";
import { getPoolNumberForSend } from "@/lib/sms-number-pool";
import { isFeatureEnabled } from "@/lib/feature-resolver";
import { logger } from "@/lib/logger";
import type { MessageClassification } from "@prisma/client";

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
  classification?: MessageClassification;
  userId?: string;
  memberId?: string;
  campaignId?: string;
}

export interface SendSingleSmsResult {
  success: boolean;
  messageId?: string;
  twilioSid?: string;
  error?: string;
  errorCode?: string;
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
  rejectedNoConsent: number;
  rejectedOptOut: number;
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
 *
 * Access is gated by the `sms` feature flag (plan defaults + superadmin overrides).
 * Plan fields (`smsIncluded`, `smsOverageRate`) only control quota/billing, never access.
 */
export async function checkUsageLimits(
  organizationId: string,
  messageCount: number = 1
): Promise<UsageLimitResult> {
  const enabled = await isFeatureEnabled(organizationId, "sms");
  if (!enabled) {
    return {
      allowed: false,
      remaining: 0,
      used: 0,
      included: 0,
      overageRate: null,
      error: "SMS is not enabled for your organization",
    };
  }

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
  const included = plan?.smsIncluded ?? 0;
  const overageRate = plan?.smsOverageRate ? Number(plan.smsOverageRate) : null;

  // Feature enabled with no included allowance: either pay-per-use (overageRate set)
  // or comped (overageRate null). Either way the flag is in charge, so allow unlimited.
  if (included === 0) {
    return {
      allowed: true,
      remaining: Infinity,
      used: 0,
      included: 0,
      overageRate,
    };
  }

  // Plan has an included allowance — enforce it, with overage spillover if configured.
  const usage = await getOrCreateUsageRecord(organizationId);
  const used = usage.messagesSent;
  const remaining = Math.max(0, included - used);

  if (used + messageCount <= included) {
    return {
      allowed: true,
      remaining: remaining - messageCount,
      used,
      included,
      overageRate,
    };
  }

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

  // Comped/unlimited access (feature flag on, plan has no allowance and no overage rate):
  // track the send but don't label it as overage.
  if (included === 0 && overageRate === 0) {
    await db.smsUsage.update({
      where: { id: usage.id },
      data: {
        messagesSent: { increment: 1 },
        totalSegments: { increment: segments },
        totalCost: { increment: cost },
      },
    });
    return;
  }

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
 * Record a send that was blocked at the consent gate before reaching Twilio.
 * Distinguishes opt-outs from never-consented users so we can prove compliance
 * posture during a Twilio toll-free verification audit.
 */
export async function recordRejection(
  organizationId: string,
  kind: "no_consent" | "opted_out"
): Promise<void> {
  // Audit-counter writes must never break the deterministic rejection contract.
  // A failing increment (transient DB issue, race, missing column mid-deploy) should
  // degrade to a logged warning, not a thrown error that masks { success: false, errorCode }.
  try {
    const usage = await getOrCreateUsageRecord(organizationId);
    await db.smsUsage.update({
      where: { id: usage.id },
      data:
        kind === "no_consent"
          ? { rejectedNoConsent: { increment: 1 } }
          : { rejectedOptOut: { increment: 1 } },
    });
  } catch (err) {
    logger.warn("SMS rejection counter write failed", {
      organizationId,
      kind,
      error: err instanceof Error ? err.message : String(err),
    });
  }
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
    rejectedNoConsent: usage.rejectedNoConsent,
    rejectedOptOut: usage.rejectedOptOut,
  };
}

// ============================================
// Sending SMS
// ============================================

/**
 * Send a single SMS message
 */
export async function sendSingleSms(params: SendSingleSmsParams): Promise<SendSingleSmsResult> {
  const { organizationId, to, body, classification = "GENERAL", userId, campaignId } = params;

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

  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { smsConsentAt: true, smsOptOut: true },
    });

    if (user?.smsOptOut) {
      await recordRejection(organizationId, "opted_out");
      logger.info("SMS send rejected", {
        reason: "opted_out",
        userId,
        organizationId,
      });
      return {
        success: false,
        error: "Recipient has opted out of SMS messages",
        errorCode: "OPTED_OUT",
      };
    }

    if (!user?.smsConsentAt) {
      await recordRejection(organizationId, "no_consent");
      logger.info("SMS send rejected", {
        reason: "no_consent",
        userId,
        organizationId,
      });
      return {
        success: false,
        error: "Recipient has not granted SMS consent",
        errorCode: "NO_CONSENT",
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

  // Resolve pool number for this recipient + org
  const fromNumber = await getPoolNumberForSend(normalizedPhone, organizationId);

  // Create message record first (for tracking)
  const smsMessage = await db.message.create({
    data: {
      organizationId,
      userId,
      campaignId,
      channel: "SMS",
      to: normalizedPhone,
      from: fromNumber,
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
    from: fromNumber,
    organizationId,
    campaignId,
  });

  if (result.success && result.sid) {
    // Update message with Twilio SID
    await db.message.update({
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
    await db.message.update({
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
  const message = await db.message.findUnique({
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

  await db.message.update({
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
    const withoutCountryCode =
      digitsOnly.startsWith("1") && digitsOnly.length === 11 ? digitsOnly.substring(1) : digitsOnly;
    const phoneVariants = [normalizedFrom, digitsOnly, withoutCountryCode];

    // Update User records (primary)
    const users = await db.user.findMany({
      where: { phone: { in: phoneVariants } },
    });

    for (const user of users) {
      await db.user.update({
        where: { id: user.id },
        data: {
          smsOptOut: isOptOut,
          smsOptOutAt: isOptOut ? new Date() : null,
        },
      });
    }
  }

  // Route ALL inbound messages to conversations
  const { routeInboundMessage } = await import("@/lib/conversation-service");
  await routeInboundMessage({
    from: From,
    to: To,
    body: Body,
    twilioSid: MessageSid,
  });
}
