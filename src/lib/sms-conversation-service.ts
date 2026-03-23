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
import type { SmsConversationStatus } from "@prisma/client";

/**
 * SMS Conversation Service
 *
 * Handles two-way SMS conversations between admin users and guardian users.
 * - Conversation threading (one thread per user)
 * - Inbound message routing
 * - Outbound message sending within conversations
 * - Conversation lifecycle (open, close, archive)
 * - Unread tracking
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
  status: SmsConversationStatus;
  lastMessageAt: Date | null;
  lastMessageBody: string | null;
  unreadCount: number;
  createdAt: Date;
}

export interface ConversationMessage {
  id: string;
  body: string;
  direction: "INBOUND" | "OUTBOUND";
  twilioStatus: string;
  createdAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  errorMessage: string | null;
}

export interface SendConversationMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================
// Conversation CRUD
// ============================================

/**
 * Get or create a conversation for a user
 */
export async function getOrCreateConversation(
  organizationId: string,
  userId: string
): Promise<string> {
  const existing = await db.smsConversation.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
  });

  if (existing) {
    if (existing.status !== "OPEN") {
      await db.smsConversation.update({
        where: { id: existing.id },
        data: { status: "OPEN" },
      });
    }
    return existing.id;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  });

  if (!user?.phone) {
    throw new Error("User has no phone number");
  }

  const normalized = normalizePhoneNumber(user.phone);
  if (!isValidE164(normalized)) {
    throw new Error("User has invalid phone number");
  }

  const conversation = await db.smsConversation.create({
    data: {
      organizationId,
      userId,
      phoneNumber: normalized,
      status: "OPEN",
    },
  });

  return conversation.id;
}

/**
 * List conversations for an organization with pagination and search
 */
export async function listConversations(
  organizationId: string,
  options: {
    status?: SmsConversationStatus;
    search?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ conversations: ConversationListItem[]; total: number }> {
  const { status, search, page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  const where: any = { organizationId };

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
    db.smsConversation.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { unreadCount: "desc" },
        { lastMessageAt: "desc" },
      ],
      skip,
      take: limit,
    }),
    db.smsConversation.count({ where }),
  ]);

  return {
    conversations: conversations.map((c) => ({
      id: c.id,
      userId: c.userId ?? "",
      userName: c.user?.name ?? "",
      userEmail: c.user?.email ?? "",
      phoneNumber: c.phoneNumber,
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
 * Get messages for a conversation with pagination
 */
export async function getConversationMessages(
  conversationId: string,
  options: { page?: number; limit?: number } = {}
): Promise<{ messages: ConversationMessage[]; total: number }> {
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    db.smsMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
      select: {
        id: true,
        body: true,
        direction: true,
        twilioStatus: true,
        createdAt: true,
        sentAt: true,
        deliveredAt: true,
        failedAt: true,
        errorMessage: true,
      },
    }),
    db.smsMessage.count({ where: { conversationId } }),
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
  return db.smsConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userId: true, organizationId: true },
  });
}

/**
 * Get a single conversation with user details
 */
export async function getConversation(conversationId: string) {
  return db.smsConversation.findUnique({
    where: { id: conversationId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          smsOptOut: true,
          athleteGuardians: {
            include: {
              athlete: {
                select: {
                  id: true,
                  name: true,
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
 * Send a message within a conversation
 */
export async function sendConversationMessage(
  conversationId: string,
  body: string,
  senderId?: string
): Promise<SendConversationMessageResult> {
  const conversation = await db.smsConversation.findUnique({
    where: { id: conversationId },
    include: { user: { select: { smsOptOut: true } } },
  });

  if (!conversation) {
    return { success: false, error: "Conversation not found" };
  }

  if (conversation.user?.smsOptOut) {
    return { success: false, error: "Recipient has opted out of SMS messages" };
  }

  if (!isTwilioConfigured()) {
    return { success: false, error: "SMS service is not configured" };
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

  const smsMessage = await db.smsMessage.create({
    data: {
      organizationId: conversation.organizationId,
      userId: conversation.userId,
      conversationId,
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
    await db.smsMessage.update({
      where: { id: smsMessage.id },
      data: {
        twilioSid: result.sid,
        twilioStatus: mapTwilioStatus(result.status || "queued"),
        sentAt: new Date(),
      },
    });

    await db.smsConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessageBody: body,
        status: "OPEN",
        athleteUnreadCount: { increment: 1 },
      },
    });

    await recordUsage(conversation.organizationId, segments);

    return { success: true, messageId: smsMessage.id };
  } else {
    await db.smsMessage.update({
      where: { id: smsMessage.id },
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

/**
 * Record a reply from the athlete/guardian portal.
 * The message is stored directly as INBOUND — no Twilio SMS is sent.
 * Uses a transaction so the message row and conversation metadata update atomically.
 */
export async function sendAthleteReply(
  conversationId: string,
  userId: string,
  body: string
): Promise<SendConversationMessageResult> {
  const conversation = await db.smsConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || conversation.userId !== userId) {
    return { success: false, error: "Conversation not found" };
  }

  const hasOrgMessage = await db.smsMessage.findFirst({
    where: { conversationId, direction: "OUTBOUND" },
    select: { id: true },
  });

  if (!hasOrgMessage) {
    return { success: false, error: "Cannot reply until the organization has sent a message" };
  }

  const now = new Date();

  const smsMessage = await db.$transaction(async (tx) => {
    const msg = await tx.smsMessage.create({
      data: {
        organizationId: conversation.organizationId,
        userId: conversation.userId,
        conversationId,
        to: "",
        from: conversation.phoneNumber,
        body,
        segments: 1,
        direction: "INBOUND",
        classification: "GENERAL",
        twilioStatus: "DELIVERED",
        deliveredAt: now,
      },
    });

    await tx.smsConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: now,
        lastMessageBody: body,
        unreadCount: { increment: 1 },
        status: "OPEN",
      },
    });

    return msg;
  });

  return { success: true, messageId: smsMessage.id };
}

// ============================================
// Conversation Status
// ============================================

/**
 * Mark a conversation as read (reset org-side unread count)
 */
export async function markConversationRead(conversationId: string): Promise<void> {
  await db.smsConversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0 },
  });
}

/**
 * Mark a conversation as read from the athlete portal (reset athlete-side unread count)
 */
export async function markConversationReadByAthlete(conversationId: string): Promise<void> {
  await db.smsConversation.update({
    where: { id: conversationId },
    data: { athleteUnreadCount: 0 },
  });
}

/**
 * Update conversation status (close, archive, reopen)
 */
export async function updateConversationStatus(
  conversationId: string,
  status: SmsConversationStatus
): Promise<void> {
  await db.smsConversation.update({
    where: { id: conversationId },
    data: { status },
  });
}

// ============================================
// Inbound Message Routing
// ============================================

/**
 * Route an inbound SMS message to the correct conversation.
 * Called from the Twilio webhook handler.
 *
 * Routing strategy (deterministic, no cross-org duplication):
 * 1. Look up (fromPhone, toNumber) in SmsNumberAssignment for a sticky match
 * 2. Fall back to the org that most recently sent an outbound to this phone
 * 3. Create an assignment for future deterministic routing
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
    digitsOnly.startsWith("1") && digitsOnly.length === 11
      ? digitsOnly.substring(1)
      : digitsOnly;
  const phoneVariants = [normalizedFrom, digitsOnly, withoutCountryCode];

  // 1. Try pool-based deterministic routing
  const poolMatch = await resolveOrgFromInbound(from, to);

  if (poolMatch) {
    await routeToOrg(poolMatch.organizationId, poolMatch.userId, {
      to, from: normalizedFrom, body, twilioSid,
    });
    return;
  }

  // 2. Fall back: find the org that most recently texted this phone
  const recentOutbound = await db.smsMessage.findFirst({
    where: {
      to: { in: phoneVariants },
      direction: "OUTBOUND",
    },
    orderBy: { createdAt: "desc" },
    select: { organizationId: true, userId: true },
  });

  if (recentOutbound?.userId) {
    await routeToOrg(recentOutbound.organizationId, recentOutbound.userId, {
      to, from: normalizedFrom, body, twilioSid,
    });

    // Create an assignment so future replies route deterministically
    const { getPoolNumberForSend: ensureAssignment } = await import("@/lib/sms-number-pool");
    try {
      await ensureAssignment(normalizedFrom, recentOutbound.organizationId);
    } catch {
      // Non-fatal: assignment creation can fail if pool is exhausted
    }
    return;
  }

  // 3. No outbound history — try org membership as last resort (single org only)
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
      to, from: normalizedFrom, body, twilioSid,
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
  const conversationId = await getOrCreateConversation(organizationId, userId);

  await db.smsMessage.create({
    data: {
      organizationId,
      userId,
      conversationId,
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

  await db.smsConversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      lastMessageBody: msg.body,
      unreadCount: { increment: 1 },
      status: "OPEN",
    },
  });
}
