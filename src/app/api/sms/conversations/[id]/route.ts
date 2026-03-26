import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";
import {
  getConversation,
  markConversationRead,
  updateConversationStatus,
} from "@/lib/sms-conversation-service";

// GET /api/sms/conversations/[id] - Get conversation detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const smsBlocked = await checkFeatureGate(session.user.organizationId, "sms");
    if (smsBlocked) return smsBlocked;

    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("communication.view")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const conversation = await getConversation(id);

    if (!conversation || conversation.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}

const updateSchema = z.object({
  status: z.enum(["OPEN", "CLOSED", "ARCHIVED"]).optional(),
  markRead: z.boolean().optional(),
});

// PATCH /api/sms/conversations/[id] - Update conversation (mark read, close, archive)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const smsBlocked = await checkFeatureGate(session.user.organizationId, "sms");
    if (smsBlocked) return smsBlocked;

    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("communication.send")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify ownership
    const conversation = await getConversation(id);
    if (!conversation || conversation.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = updateSchema.parse(body);

    if (data.markRead) {
      await markConversationRead(id);
    }

    if (data.status) {
      await updateConversationStatus(id, data.status);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error updating conversation:", error);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}
