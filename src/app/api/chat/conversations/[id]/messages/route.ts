import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";
import {
  getConversation,
  getConversationMessages,
  sendConversationMessage,
  markConversationRead,
} from "@/lib/conversation-service";

// GET /api/chat/conversations/[id]/messages - Get messages for a conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("communication.view")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const conversation = await getConversation(id, session.user.organizationId);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));

    const result = await getConversationMessages(id, {
      page,
      limit,
      organizationId: session.user.organizationId,
    });

    if (conversation.unreadCount > 0) {
      await markConversationRead(id, session.user.organizationId);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching conversation messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

const sendMessageSchema = z.object({
  body: z.string().trim().min(1, "Message body is required").max(5000, "Message too long"),
});

// POST /api/chat/conversations/[id]/messages - Send a message in a conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("communication.send")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const conversation = await getConversation(id, session.user.organizationId);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Feature gate: if conversation is WEB_SMS, the sms feature must be enabled
    if (conversation.channel === "WEB_SMS") {
      const smsBlocked = await checkFeatureGate(session.user.organizationId, "sms");
      if (smsBlocked) return smsBlocked;
    }

    const reqBody = await request.json();
    const { body } = sendMessageSchema.parse(reqBody);

    const result = await sendConversationMessage(id, body, session.user.organizationId, session.user.id);

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
    console.error("Error sending conversation message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
