import { db } from "@/lib/db";
import {
  sendSms,
  calculateSegments,
  normalizePhoneNumber,
  isValidE164,
  mapTwilioStatus,
  isTwilioConfigured,
} from "@/lib/twilio";
import { checkUsageLimits, recordUsage } from "@/lib/sms-service";
import { getPoolNumberForSend, resolveOrgFromInbound } from "@/lib/sms-number-pool";
import type { ConversationStatus, ConversationChannel } from "@prisma/client";

/**
 * Conversation Service
 *
 * Multi-channel conversation system supporting Web Only, Web & SMS, and Web & Email.
 * - Conversation threading (one thread per user per org)
 * - Multi-channel outbound dispatch (web-only, SMS via Twilio, email via SES)
 * - Inbound message routing (SMS via Twilio webhook, email via SES inbound)
 * - Conversation lifecycle (open, close, archive)
 * - Unread tracking (org-side and athlete-side)
 */

// ============================================
// Types
// ============================================

export interface ConversationListItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  phoneNumber: string;
  email: string | null;
  channel: ConversationChannel;
  status: ConversationStatus;
  lastMessageAt: Date | null;
  lastMessageBody: string | null;
  unreadCount: number;
  createdAt: Date;
}

export interface ConversationMessage {
  id: string;
  body: string;
  channel: string;
  direction: "INBOUND" | "OUTBOUND";
  twilioStatus: string;
  createdAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  errorMessage: string | null;
  emailSubject: string | null;
  htmlBody: string | null;
}

export interface SendConversationMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  code?: string;
}

// ============================================
// Conversation CRUD
// ============================================

/**
 * Get or create a conversation for a user.
 * For WEB_SMS, requires a valid phone number.
 * For WEB_EMAIL, requires an email address.
 * For WEB_ONLY, neither is strictly required.
 */
export async function getOrCreateConversation(
  organizationId: string,
  userId: string,
  channel: ConversationChannel = "WEB_SMS"
): Promise<string> {
  const existing = await db.conversation.findFirst({
    where: {
      organizationId,
      userId,
      coachId: null,
    },
  });

  if (existing) {
    if (existing.status !== "OPEN") {
      await db.conversation.update({
        where: { id: existing.id },
        data: { status: "OPEN" },
      });
    }
    return existing.id;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { phone: true, phoneVerified: true, email: true },
  });

  const data: any = {
    organizationId,
    userId,
    channel,
    phoneNumber: "",
    status: "OPEN",
  };

  if (channel === "WEB_SMS") {
    if (!user?.phone) {
      throw new Error("User has no phone number");
    }
    if (!user.phoneVerified) {
      throw new Error("User phone number is not verified");
    }
    const normalized = normalizePhoneNumber(user.phone);
    if (!isValidE164(normalized)) {
      throw new Error("User has invalid phone number");
    }
    data.phoneNumber = normalized;
  }

  if (channel === "WEB_EMAIL") {
    if (!user?.email) {
      throw new Error("User has no email address");
    }
    data.email = user.email;
  }

  if (channel === "WEB_ONLY" && user?.email) {
    data.email = user.email;
  }

  const conversation = await db.conversation.create({ data });
  return conversation.id;
}

/**
 * List conversations for an organization with pagination and search
 */
export async function listConversations(
  organizationId: string,
  options: {
    status?: ConversationStatus;
    search?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ conversations: ConversationListItem[]; total: number }> {
  const { status, search, page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  const where: any = { organizationId, coachId: null };

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { phoneNumber: { contains: search } },
    ];
  }

  const [conversations, total] = await Promise.all([
    db.conversation.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ unreadCount: "desc" }, { lastMessageAt: "desc" }],
      skip,
      take: limit,
    }),
    db.conversation.count({ where }),
  ]);

  return {
    conversations: conversations.map((c) => ({
      id: c.id,
      userId: c.userId ?? "",
      userName: c.user?.name ?? "",
      userEmail: c.user?.email ?? "",
      phoneNumber: c.phoneNumber,
      email: c.email,
      channel: c.channel,
      status: c.status,
      lastMessageAt: c.lastMessageAt,
      lastMessageBody: c.lastMessageBody,
      unreadCount: c.unreadCount,
      createdAt: c.createdAt,
    })),
    total,
  };
}

/**
 * Get messages for a conversation with pagination.
 * Requires organizationId for admin callers or userId for athlete callers
 * to enforce tenant isolation at the service layer.
 */
export async function getConversationMessages(
  conversationId: string,
  options: {
    page?: number;
    limit?: number;
    organizationId?: string;
    userId?: string;
  } = {}
): Promise<{ messages: ConversationMessage[]; total: number }> {
  const { page = 1, limit = 50, organizationId, userId } = options;
  const skip = (page - 1) * limit;

  const where: any = { conversationId };
  if (organizationId) where.organizationId = organizationId;
  if (userId) where.userId = userId;

  const [messages, total] = await Promise.all([
    db.message.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
      select: {
        id: true,
        body: true,
        channel: true,
        direction: true,
        twilioStatus: true,
        createdAt: true,
        sentAt: true,
        deliveredAt: true,
        failedAt: true,
        errorMessage: true,
        emailSubject: true,
        htmlBody: true,
      },
    }),
    db.message.count({ where }),
  ]);

  return {
    messages: messages.map((m) => ({
      ...m,
      direction: m.direction as "INBOUND" | "OUTBOUND",
    })),
    total,
  };
}

/**
 * Lightweight ownership check — returns only the fields needed to verify
 * that a conversation exists and belongs to the given user.
 */
export async function getConversationOwnership(conversationId: string) {
  return db.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userId: true, organizationId: true, channel: true },
  });
}

/**
 * Get a single conversation with user details.
 * When organizationId is provided, enforces tenant isolation at the query level.
 */
export async function getConversation(conversationId: string, organizationId?: string) {
  const where: any = { id: conversationId, coachId: null };
  if (organizationId) where.organizationId = organizationId;

  return db.conversation.findFirst({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          phoneVerified: true,
          smsOptOut: true,
          athleteGuardians: {
            include: {
              athlete: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  birthDate: true,
                },
              },
            },
            take: 5,
          },
        },
      },
    },
  });
}

// ============================================
// Sending Messages in Conversations
// ============================================

/**
 * Send a message within a conversation, dispatching to the appropriate
 * channel based on the conversation type.
 * Requires organizationId for tenant-scoped lookup.
 */
export async function sendConversationMessage(
  conversationId: string,
  body: string,
  organizationId: string,
  senderId?: string
): Promise<SendConversationMessageResult> {
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, organizationId },
    include: {
      user: { select: { smsOptOut: true, email: true } },
      coach: { select: { name: true } },
    },
  });

  if (!conversation) {
    return { success: false, error: "Conversation not found" };
  }

  switch (conversation.channel) {
    case "WEB_SMS":
      return sendViaSms(conversation, body);
    case "WEB_EMAIL":
      return sendViaEmail(conversation, body);
    case "WEB_ONLY":
      return sendWebOnly(conversation, body);
    default:
      return { success: false, error: "Unknown conversation channel" };
  }
}

async function sendWebOnly(
  conversation: { id: string; organizationId: string; userId: string | null },
  body: string
): Promise<SendConversationMessageResult> {
  const now = new Date();

  const msg = await db.$transaction(async (tx) => {
    const m = await tx.message.create({
      data: {
        organizationId: conversation.organizationId,
        userId: conversation.userId,
        conversationId: conversation.id,
        channel: "WEB",
        body,
        direction: "OUTBOUND",
        classification: "GENERAL",
        twilioStatus: "DELIVERED",
        deliveredAt: now,
      },
    });

    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: now,
        lastMessageBody: body,
        status: "OPEN",
        athleteUnreadCount: { increment: 1 },
      },
    });

    return m;
  });

  return { success: true, messageId: msg.id };
}

const TWILIO_MAX_BODY_LENGTH = 1600;

async function sendViaSms(
  conversation: {
    id: string;
    organizationId: string;
    userId: string | null;
    phoneNumber: string;
    user: { smsOptOut: boolean; email: string | null } | null;
  },
  body: string
): Promise<SendConversationMessageResult> {
  if (body.length > TWILIO_MAX_BODY_LENGTH) {
    return {
      success: false,
      error: `SMS messages cannot exceed ${TWILIO_MAX_BODY_LENGTH} characters (yours is ${body.length})`,
      code: "SMS_TOO_LONG",
    };
  }

  if (conversation.user?.smsOptOut) {
    return { success: false, error: "Recipient has opted out of SMS messages" };
  }

  if (!isTwilioConfigured()) {
    return { success: false, error: "SMS service is not configured", code: "SMS_NOT_CONFIGURED" };
  }

  const limits = await checkUsageLimits(conversation.organizationId);
  if (!limits.allowed) {
    return { success: false, error: limits.error || "SMS limit reached" };
  }

  const segments = calculateSegments(body);

  const fromNumber = await getPoolNumberForSend(
    conversation.phoneNumber,
    conversation.organizationId
  );

  const msg = await db.message.create({
    data: {
      organizationId: conversation.organizationId,
      userId: conversation.userId,
      conversationId: conversation.id,
      channel: "SMS",
      to: conversation.phoneNumber,
      from: fromNumber,
      body,
      segments,
      direction: "OUTBOUND",
      classification: "GENERAL",
      twilioStatus: "QUEUED",
    },
  });

  const result = await sendSms({
    to: conversation.phoneNumber,
    body,
    from: fromNumber,
    organizationId: conversation.organizationId,
  });

  if (result.success && result.sid) {
    await db.message.update({
      where: { id: msg.id },
      data: {
        twilioSid: result.sid,
        twilioStatus: mapTwilioStatus(result.status || "queued"),
        sentAt: new Date(),
      },
    });

    await db.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessageBody: body,
        status: "OPEN",
        athleteUnreadCount: { increment: 1 },
      },
    });

    await recordUsage(conversation.organizationId, segments);

    return { success: true, messageId: msg.id };
  } else {
    await db.message.update({
      where: { id: msg.id },
      data: {
        twilioStatus: "FAILED",
        failedAt: new Date(),
        errorCode: result.errorCode,
        errorMessage: result.error,
      },
    });

    return { success: false, error: result.error };
  }
}

async function sendViaEmail(
  conversation: {
    id: string;
    organizationId: string;
    userId: string | null;
    coachId: string | null;
    email: string | null;
    user: { smsOptOut: boolean; email: string | null } | null;
    coach: { name: string | null } | null;
  },
  body: string
): Promise<SendConversationMessageResult> {
  const recipientEmail = conversation.email || conversation.user?.email;
  if (!recipientEmail) {
    return { success: false, error: "No email address for this conversation" };
  }

  const { sendChatEmail } = await import("@/lib/chat-email");

  const now = new Date();
  const msg = await db.message.create({
    data: {
      organizationId: conversation.organizationId,
      userId: conversation.userId,
      conversationId: conversation.id,
      channel: "EMAIL",
      to: recipientEmail,
      body,
      direction: "OUTBOUND",
      classification: "GENERAL",
      twilioStatus: "QUEUED",
    },
  });

  try {
    const emailResult = await sendChatEmail({
      to: recipientEmail,
      body,
      conversationId: conversation.id,
      organizationId: conversation.organizationId,
      senderRole: conversation.coachId ? "coach" : "admin",
      coachName: conversation.coach?.name || undefined,
    });

    await db.message.update({
      where: { id: msg.id },
      data: {
        sesMessageId: emailResult.messageId || null,
        twilioStatus: "SENT",
        sentAt: now,
      },
    });

    await db.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: now,
        lastMessageBody: body,
        status: "OPEN",
        athleteUnreadCount: { increment: 1 },
      },
    });

    return { success: true, messageId: msg.id };
  } catch (error: any) {
    await db.message.update({
      where: { id: msg.id },
      data: {
        twilioStatus: "FAILED",
        failedAt: now,
        errorMessage: error.message || "Email send failed",
      },
    });

    return { success: false, error: error.message || "Failed to send email" };
  }
}

/**
 * Record a reply from the athlete/guardian portal.
 * Always stored as a WEB channel message regardless of conversation channel.
 */
export async function sendAthleteReply(
  conversationId: string,
  userId: string,
  body: string
): Promise<SendConversationMessageResult> {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || conversation.userId !== userId) {
    return { success: false, error: "Conversation not found" };
  }

  const now = new Date();

  const msg = await db.$transaction(async (tx) => {
    const m = await tx.message.create({
      data: {
        organizationId: conversation.organizationId,
        userId: conversation.userId,
        conversationId,
        channel: "WEB",
        body,
        direction: "INBOUND",
        classification: "GENERAL",
        twilioStatus: "DELIVERED",
        deliveredAt: now,
      },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: now,
        lastMessageBody: body,
        unreadCount: { increment: 1 },
        status: "OPEN",
      },
    });

    return m;
  });

  return { success: true, messageId: msg.id };
}

// ============================================
// Conversation Status
// ============================================

/**
 * Mark conversation as read (admin-side unread counter).
 * Verifies the conversation belongs to the given organization before updating.
 */
export async function markConversationRead(
  conversationId: string,
  organizationId: string
): Promise<void> {
  const result = await db.conversation.updateMany({
    where: { id: conversationId, organizationId },
    data: { unreadCount: 0 },
  });
  if (result.count === 0) {
    throw new Error("Conversation not found or access denied");
  }
}

/**
 * Mark conversation as read (athlete-side unread counter).
 * Verifies the conversation belongs to the given user before updating.
 */
export async function markConversationReadByAthlete(
  conversationId: string,
  userId: string
): Promise<void> {
  const result = await db.conversation.updateMany({
    where: { id: conversationId, userId },
    data: { athleteUnreadCount: 0 },
  });
  if (result.count === 0) {
    throw new Error("Conversation not found or access denied");
  }
}

/**
 * Update conversation status (open, closed, archived).
 * Verifies the conversation belongs to the given organization before updating.
 */
export async function updateConversationStatus(
  conversationId: string,
  status: ConversationStatus,
  organizationId: string
): Promise<void> {
  const result = await db.conversation.updateMany({
    where: { id: conversationId, organizationId },
    data: { status },
  });
  if (result.count === 0) {
    throw new Error("Conversation not found or access denied");
  }
}

// ============================================
// Inbound Message Routing (SMS)
// ============================================

/**
 * Route an inbound SMS message to the correct conversation.
 * Called from the Twilio webhook handler.
 */
export async function routeInboundMessage(params: {
  from: string;
  to: string;
  body: string;
  twilioSid: string;
}): Promise<void> {
  const { from, to, body, twilioSid } = params;
  const normalizedFrom = normalizePhoneNumber(from);

  const digitsOnly = normalizedFrom.replace(/\D/g, "");
  const withoutCountryCode =
    digitsOnly.startsWith("1") && digitsOnly.length === 11 ? digitsOnly.substring(1) : digitsOnly;
  const phoneVariants = [normalizedFrom, digitsOnly, withoutCountryCode];

  const poolMatch = await resolveOrgFromInbound(from, to);

  if (poolMatch) {
    await routeToOrg(poolMatch.organizationId, poolMatch.userId, {
      to,
      from: normalizedFrom,
      body,
      twilioSid,
    });
    return;
  }

  const recentOutbound = await db.message.findFirst({
    where: {
      to: { in: phoneVariants },
      direction: "OUTBOUND",
      channel: "SMS",
    },
    orderBy: { createdAt: "desc" },
    select: { organizationId: true, userId: true },
  });

  if (recentOutbound?.userId) {
    await routeToOrg(recentOutbound.organizationId, recentOutbound.userId, {
      to,
      from: normalizedFrom,
      body,
      twilioSid,
    });

    const { getPoolNumberForSend: ensureAssignment } = await import("@/lib/sms-number-pool");
    try {
      await ensureAssignment(normalizedFrom, recentOutbound.organizationId);
    } catch {
      // Non-fatal
    }
    return;
  }

  const member = await db.organizationMember.findFirst({
    where: {
      user: { phone: { in: phoneVariants } },
      status: "ACTIVE",
    },
    orderBy: { joinedAt: "desc" },
    select: { organizationId: true, userId: true },
  });

  if (member) {
    await routeToOrg(member.organizationId, member.userId, {
      to,
      from: normalizedFrom,
      body,
      twilioSid,
    });
    return;
  }

  console.warn(
    `\x1b[33m[SMS INBOUND]\x1b[0m No routing match for inbound from ${normalizedFrom}. Message dropped.`
  );
}

async function routeToOrg(
  organizationId: string,
  userId: string,
  msg: { to: string; from: string; body: string; twilioSid: string }
): Promise<void> {
  const conversationId = await getOrCreateConversation(organizationId, userId, "WEB_SMS");

  await db.message.create({
    data: {
      organizationId,
      userId,
      conversationId,
      channel: "SMS",
      to: msg.to,
      from: msg.from,
      body: msg.body,
      twilioSid: msg.twilioSid,
      twilioStatus: "DELIVERED",
      direction: "INBOUND",
      classification: "GENERAL",
      deliveredAt: new Date(),
    },
  });

  await db.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      lastMessageBody: msg.body,
      unreadCount: { increment: 1 },
      status: "OPEN",
    },
  });
}

// ============================================
// Inbound Email Routing
// ============================================

/**
 * Route an inbound email reply to the correct conversation.
 * Called from the SES inbound webhook handler.
 */
export async function routeInboundEmail(params: {
  conversationId: string;
  senderEmail: string;
  from: string;
  subject: string;
  textBody: string;
  htmlBody: string | null;
  sesMessageId: string;
}): Promise<void> {
  const { conversationId, senderEmail, from, subject, textBody, htmlBody, sesMessageId } = params;

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { user: { select: { email: true } } },
  });

  if (!conversation) {
    console.warn(`[EMAIL INBOUND] Conversation ${conversationId} not found. Email dropped.`);
    return;
  }

  if (conversation.channel !== "WEB_EMAIL") {
    console.warn(
      `[EMAIL INBOUND] Conversation ${conversationId} is not an email conversation. Email dropped.`
    );
    return;
  }

  const expectedEmail = conversation.email || conversation.user?.email;
  if (!expectedEmail) {
    console.warn(
      `[EMAIL INBOUND] Conversation ${conversationId} has no expected email address. Email dropped.`
    );
    return;
  }

  const normalizedSender = senderEmail.toLowerCase().trim();
  const normalizedExpected = expectedEmail.toLowerCase().trim();
  if (normalizedSender !== normalizedExpected) {
    console.warn(
      `[EMAIL INBOUND] Sender mismatch for conversation ${conversationId}: expected ${normalizedExpected}, got ${normalizedSender}. Email dropped.`
    );
    return;
  }

  const now = new Date();

  await db.message.create({
    data: {
      organizationId: conversation.organizationId,
      userId: conversation.userId,
      conversationId,
      channel: "EMAIL",
      to: "",
      from,
      body: textBody,
      htmlBody,
      emailSubject: subject,
      sesMessageId,
      twilioStatus: "DELIVERED",
      direction: "INBOUND",
      classification: "GENERAL",
      deliveredAt: now,
    },
  });

  await db.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: now,
      lastMessageBody: textBody.substring(0, 200),
      unreadCount: { increment: 1 },
      status: "OPEN",
    },
  });
}

// ============================================
// Coach Conversations
// ============================================

export interface CoachConversationListItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  phoneNumber: string;
  email: string | null;
  channel: ConversationChannel;
  status: ConversationStatus;
  lastMessageAt: Date | null;
  lastMessageBody: string | null;
  unreadCount: number;
  createdAt: Date;
  organizationId: string;
  organizationName: string;
}

/**
 * Get or create a coach-specific conversation.
 * Coach conversations are unique on (userId, coachId) — one thread per pair,
 * regardless of how many orgs they share. The organizationId is set only on
 * first creation (for billing).
 */
export async function getOrCreateCoachConversation(
  organizationId: string,
  userId: string,
  coachId: string,
  channel: ConversationChannel = "WEB_ONLY"
): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      phone: true,
      phoneVerified: true,
      email: true,
      coachConversations: {
        where: { coachId },
        select: { id: true, status: true, organizationId: true },
        take: 1,
      },
    },
  });

  const existing = user?.coachConversations[0];
  if (existing) {
    if (existing.status !== "OPEN") {
      await db.conversation.updateMany({
        where: { id: existing.id, organizationId: existing.organizationId },
        data: { status: "OPEN" },
      });
    }
    return existing.id;
  }

  if (!user) throw new Error("User not found");

  const data: any = {
    organizationId,
    userId,
    coachId,
    channel,
    phoneNumber: "",
    status: "OPEN",
  };

  if (channel === "WEB_SMS") {
    if (!user?.phone) throw new Error("User has no phone number");
    if (!user.phoneVerified) throw new Error("User phone number is not verified");
    const normalized = normalizePhoneNumber(user.phone);
    if (!isValidE164(normalized)) throw new Error("User has invalid phone number");
    data.phoneNumber = normalized;
  }

  if (channel === "WEB_EMAIL") {
    if (!user?.email) throw new Error("User has no email address");
    data.email = user.email;
  }

  if (channel === "WEB_ONLY" && user?.email) {
    data.email = user.email;
  }

  const conversation = await db.conversation.create({ data });
  return conversation.id;
}

/**
 * List conversations for a coach across their affiliated organizations.
 */
export async function listCoachConversations(
  coachId: string,
  orgIds: string[],
  options: {
    status?: ConversationStatus;
    search?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ conversations: CoachConversationListItem[]; total: number }> {
  const { status, search, page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  const where: any = {
    coachId,
    organizationId: { in: orgIds },
  };

  if (status) where.status = status;

  if (search) {
    where.OR = [
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { phoneNumber: { contains: search } },
    ];
  }

  const [conversations, total] = await Promise.all([
    db.conversation.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        organization: { select: { name: true } },
      },
      orderBy: [{ unreadCount: "desc" }, { lastMessageAt: "desc" }],
      skip,
      take: limit,
    }),
    db.conversation.count({ where }),
  ]);

  return {
    conversations: conversations.map((c) => ({
      id: c.id,
      userId: c.userId ?? "",
      userName: c.user?.name ?? "",
      userEmail: c.user?.email ?? "",
      phoneNumber: c.phoneNumber,
      email: c.email,
      channel: c.channel,
      status: c.status,
      lastMessageAt: c.lastMessageAt,
      lastMessageBody: c.lastMessageBody,
      unreadCount: c.unreadCount,
      createdAt: c.createdAt,
      organizationId: c.organizationId,
      organizationName: c.organization.name,
    })),
    total,
  };
}

/**
 * Get a single coach conversation with user and organization details.
 */
export async function getCoachConversation(conversationId: string, coachId: string) {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      organization: { select: { name: true } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          phoneVerified: true,
          smsOptOut: true,
          athleteGuardians: {
            include: {
              athlete: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
            take: 5,
          },
        },
      },
    },
  });

  if (!conversation || conversation.coachId !== coachId) return null;
  return conversation;
}

/**
 * Send a message in a coach conversation.
 * Validates that the conversation belongs to the coach, then delegates
 * to the existing channel dispatch (which uses conversation.organizationId
 * for billing).
 */
export async function sendCoachMessage(
  conversationId: string,
  body: string,
  coachId: string,
  organizationId: string
): Promise<SendConversationMessageResult> {
  return sendConversationMessage(conversationId, body, organizationId, coachId);
}

/**
 * Mark a coach conversation as read (coach-side unread counter).
 */
export async function markCoachConversationRead(
  conversationId: string,
  coachId: string,
  organizationId: string
): Promise<void> {
  const result = await db.conversation.updateMany({
    where: { id: conversationId, coachId, organizationId },
    data: { unreadCount: 0 },
  });
  if (result.count === 0) {
    throw new Error("Conversation not found or access denied");
  }
}

/**
 * Update status on a coach conversation.
 */
export async function updateCoachConversationStatus(
  conversationId: string,
  status: ConversationStatus,
  coachId: string,
  organizationId: string
): Promise<void> {
  const result = await db.conversation.updateMany({
    where: { id: conversationId, coachId, organizationId },
    data: { status },
  });
  if (result.count === 0) {
    throw new Error("Conversation not found or access denied");
  }
}

/**
 * Get guardians available for a coach to start conversations with.
 * Returns guardians whose athletes are enrolled in programs the coach is
 * assigned to (via ProgramStaff or Event.coachId).
 */
export async function getCoachConversationGuardians(
  coachUserId: string,
  memberships: Array<{ memberId: string; organizationId: string; organizationName: string }>,
  search?: string
): Promise<
  Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    phoneVerified: boolean;
    organizationId: string;
    organizationName: string;
  }>
> {
  const orgIds = memberships.map((m) => m.organizationId);
  const memberIds = memberships.map((m) => m.memberId);
  const orgNameMap = Object.fromEntries(
    memberships.map((m) => [m.organizationId, m.organizationName])
  );

  const [staffAssignments, coachEvents] = await Promise.all([
    db.programStaff.findMany({
      where: { memberId: { in: memberIds } },
      select: { programId: true, member: { select: { organizationId: true } } },
    }),
    db.event.findMany({
      where: { coachId: coachUserId, organizationId: { in: orgIds } },
      select: { programId: true, organizationId: true },
    }),
  ]);

  const programOrgMap = new Map<string, string>();
  for (const a of staffAssignments) {
    programOrgMap.set(a.programId, a.member.organizationId);
  }
  for (const e of coachEvents) {
    if (e.programId) programOrgMap.set(e.programId, e.organizationId);
  }

  const programIds = Array.from(programOrgMap.keys());
  if (programIds.length === 0) return [];

  const enrollments = await db.enrollment.findMany({
    where: {
      programId: { in: programIds },
      status: "ACTIVE",
      athlete: {
        organizationAthletes: { some: { organizationId: { in: orgIds } } },
      },
    },
    select: {
      programId: true,
      athlete: {
        select: {
          guardians: {
            where: { userId: { not: null } },
            select: { userId: true },
          },
        },
      },
    },
  });

  const guardianOrgMap = new Map<string, string>();
  for (const enrollment of enrollments) {
    const enrollmentOrgId = programOrgMap.get(enrollment.programId);
    if (!enrollmentOrgId) continue;
    for (const g of enrollment.athlete.guardians) {
      if (g.userId && !guardianOrgMap.has(g.userId)) {
        guardianOrgMap.set(g.userId, enrollmentOrgId);
      }
    }
  }

  const guardianUserIds = Array.from(guardianOrgMap.keys());
  if (guardianUserIds.length === 0) return [];

  const userWhere: any = { id: { in: guardianUserIds } };
  if (search) {
    userWhere.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const users = await db.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      phoneVerified: true,
    },
    orderBy: { name: "asc" },
    take: 100,
  });

  return users.map((u) => {
    const guardianOrgId = guardianOrgMap.get(u.id)!;
    return {
      id: u.id,
      name: u.name || "",
      email: u.email || "",
      phone: u.phone,
      phoneVerified: u.phoneVerified,
      organizationId: guardianOrgId,
      organizationName: orgNameMap[guardianOrgId] || "",
    };
  });
}
