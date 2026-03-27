import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";
import {
  getCoachConversation,
  getConversationMessages,
  sendCoachMessage,
  markCoachConversationRead,
} from "@/lib/conversation-service";
import { getEffectiveUser, getCoachingMemberships } from "@/lib/impersonation";

// GET /api/coach/chat/conversations/[id]/messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const effectiveUser = await getEffectiveUser(session);
    if (!effectiveUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coachingMemberships = await getCoachingMemberships(session);
    if (coachingMemberships.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const conversation = await getCoachConversation(id, effectiveUser.userId);
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50") || 50)
    );

    const result = await getConversationMessages(id, {
      page,
      limit,
      organizationId: conversation.organizationId,
    });

    if (conversation.unreadCount > 0) {
      await markCoachConversationRead(id, effectiveUser.userId, conversation.organizationId);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching coach conversation messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

const sendMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Message body is required")
    .max(5000, "Message too long"),
});

// POST /api/coach/chat/conversations/[id]/messages - Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const effectiveUser = await getEffectiveUser(session);
    if (!effectiveUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coachingMemberships = await getCoachingMemberships(session);
    if (coachingMemberships.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const conversation = await getCoachConversation(id, effectiveUser.userId);
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (conversation.channel === "WEB_SMS") {
      const smsBlocked = await checkFeatureGate(
        conversation.organizationId,
        "sms"
      );
      if (smsBlocked) return smsBlocked;
    }

    const reqBody = await request.json();
    const { body } = sendMessageSchema.parse(reqBody);

    const result = await sendCoachMessage(id, body, effectiveUser.userId, conversation.organizationId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error sending coach message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
