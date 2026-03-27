import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";
import {
  listConversations,
  getOrCreateConversation,
} from "@/lib/conversation-service";
import { db } from "@/lib/db";

// GET /api/chat/conversations - List conversations
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const validStatuses = ["OPEN", "CLOSED", "ARCHIVED"] as const;
    const rawStatus = searchParams.get("status");
    const status = rawStatus && validStatuses.includes(rawStatus as any)
      ? (rawStatus as typeof validStatuses[number])
      : undefined;
    const search = searchParams.get("search") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));

    const result = await listConversations(session.user.organizationId, {
      status,
      search,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

const createConversationSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  channel: z.enum(["WEB_ONLY", "WEB_SMS", "WEB_EMAIL"]).default("WEB_ONLY"),
});

// POST /api/chat/conversations - Start a new conversation
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { userId, channel } = createConversationSchema.parse(body);

    const organizationId = session.user.organizationId;

    // Feature gate: WEB_SMS requires the sms feature
    if (channel === "WEB_SMS") {
      const smsBlocked = await checkFeatureGate(organizationId, "sms");
      if (smsBlocked) return smsBlocked;
    }

    // Verify user belongs to this org
    const user = await db.user.findFirst({
      where: {
        id: userId,
        OR: [
          {
            memberships: {
              some: { organizationId, status: "ACTIVE" },
            },
          },
          {
            athleteGuardians: {
              some: {
                athlete: {
                  organizationAthletes: { some: { organizationId } },
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        phone: true,
        phoneVerified: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Channel-specific validation
    if (channel === "WEB_SMS") {
      if (!user.phone) {
        return NextResponse.json(
          { error: "User does not have a phone number", code: "NO_PHONE_NUMBER" },
          { status: 400 }
        );
      }
      if (!user.phoneVerified) {
        return NextResponse.json(
          { error: "User does not have a verified phone number", code: "PHONE_NOT_VERIFIED" },
          { status: 400 }
        );
      }
    }

    if (channel === "WEB_EMAIL" && !user.email) {
      return NextResponse.json(
        { error: "User does not have an email address", code: "NO_EMAIL" },
        { status: 400 }
      );
    }

    const conversationId = await getOrCreateConversation(
      organizationId,
      userId,
      channel
    );

    return NextResponse.json({
      success: true,
      conversationId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
