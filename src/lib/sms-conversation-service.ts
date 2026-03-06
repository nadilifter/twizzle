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

  const smsMessage = await db.smsMessage.create({
    data: {
      organizationId: conversation.organizationId,
      userId: conversation.userId,
      conversationId,
      to: conversation.phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER || "",
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

// ============================================
// Conversation Status
// ============================================

/**
 * Mark a conversation as read (reset unread count)
 */
export async function markConversationRead(conversationId: string): Promise<void> {
  await db.smsConversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0 },
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
 * Multi-tenant routing strategy:
 * 1. Look up users by phone number
 * 2. If multiple orgs have the same user phone, use the `To` number to match
 * 3. Fall back to most recent outbound message to that phone
 */
export async function routeInboundMessage(params: {
  from: string;
  to: string;
  body: string;
  twilioSid: string;
}): Promise<void> {
  const { from, to, body, twilioSid } = params;
  const normalizedFrom = normalizePhoneNumber(from);

  // Build phone variants for flexible matching
  const digitsOnly = normalizedFrom.replace(/\D/g, "");
  const withoutCountryCode = digitsOnly.startsWith("1") && digitsOnly.length === 11
    ? digitsOnly.substring(1)
    : digitsOnly;
  const phoneVariants = [
    normalizedFrom,
    digitsOnly,
    withoutCountryCode,
  ];

  // Find org members with this phone number via their user
  const members = await db.organizationMember.findMany({
    where: {
      user: { phone: { in: phoneVariants } },
      status: "ACTIVE",
    },
    select: {
      organizationId: true,
      userId: true,
      user: { select: { name: true } },
    },
  });

  if (members.length === 0) {
    // No matching user -- try to find by recent outbound messages
    const recentOutbound = await db.smsMessage.findFirst({
      where: {
        to: { in: phoneVariants },
        direction: "OUTBOUND",
      },
      orderBy: { createdAt: "desc" },
      select: {
        organizationId: true,
        userId: true,
      },
    });

    if (recentOutbound?.userId) {
      const conversationId = await getOrCreateConversation(
        recentOutbound.organizationId,
        recentOutbound.userId
      );

      await db.smsMessage.create({
        data: {
          organizationId: recentOutbound.organizationId,
          userId: recentOutbound.userId,
          conversationId,
          to,
          from: normalizedFrom,
          body,
          twilioSid,
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
          lastMessageBody: body,
          unreadCount: { increment: 1 },
          status: "OPEN",
        },
      });
    }
    return;
  }

  // Route to each matching member's conversation
  for (const member of members) {
    const conversationId = await getOrCreateConversation(
      member.organizationId,
      member.userId
    );

    await db.smsMessage.create({
      data: {
        organizationId: member.organizationId,
        userId: member.userId,
        conversationId,
        to,
        from: normalizedFrom,
        body,
        twilioSid,
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
        lastMessageBody: body,
        unreadCount: { increment: 1 },
        status: "OPEN",
      },
    });
  }
}
