import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";
import {
  listCoachConversations,
  getOrCreateCoachConversation,
} from "@/lib/conversation-service";
import { getEffectiveUser, getCoachingMemberships } from "@/lib/impersonation";
import { db } from "@/lib/db";

// GET /api/coach/chat/conversations - List conversations for the coach
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const effectiveUser = await getEffectiveUser(session);
    if (!effectiveUser) {
      return NextResponse.json({ conversations: [], total: 0 });
    }

    const coachingMemberships = await getCoachingMemberships(session);
    if (coachingMemberships.length === 0) {
      return NextResponse.json({ conversations: [], total: 0 });
    }

    const searchParams = request.nextUrl.searchParams;
    const validStatuses = ["OPEN", "CLOSED", "ARCHIVED"] as const;
    const rawStatus = searchParams.get("status");
    const status =
      rawStatus && validStatuses.includes(rawStatus as any)
        ? (rawStatus as (typeof validStatuses)[number])
        : undefined;
    const search = searchParams.get("search") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50") || 50)
    );

    const orgIds = coachingMemberships.map((m) => m.organizationId);

    const result = await listCoachConversations(
      effectiveUser.userId,
      orgIds,
      { status, search, page, limit }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching coach conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

const createConversationSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  organizationId: z.string().min(1, "Organization ID is required"),
  channel: z.enum(["WEB_ONLY", "WEB_SMS", "WEB_EMAIL"]).default("WEB_ONLY"),
});

// POST /api/coach/chat/conversations - Start a new coach conversation
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { userId, organizationId, channel } =
      createConversationSchema.parse(body);

    // Validate the coach is affiliated with this org
    const validOrg = coachingMemberships.find(
      (m) => m.organizationId === organizationId
    );
    if (!validOrg) {
      return NextResponse.json(
        { error: "Not affiliated with this organization" },
        { status: 403 }
      );
    }

    if (channel === "WEB_SMS") {
      const smsBlocked = await checkFeatureGate(organizationId, "sms");
      if (smsBlocked) return smsBlocked;
    }

    // Verify user is a guardian connected to this coach's programs
    const orgIds = coachingMemberships.map((m) => m.organizationId);
    const memberIds = coachingMemberships.map((m) => m.memberId);

    const [staffAssignments, coachEvents] = await Promise.all([
      db.programStaff.findMany({
        where: { memberId: { in: memberIds } },
        select: { programId: true },
      }),
      db.event.findMany({
        where: {
          coachId: effectiveUser.userId,
          organizationId: { in: orgIds },
        },
        select: { programId: true },
      }),
    ]);

    const programIds = Array.from(
      new Set([
        ...staffAssignments.map((a) => a.programId),
        ...coachEvents
          .map((e) => e.programId)
          .filter((id): id is string => id !== null),
      ])
    );

    if (programIds.length === 0) {
      return NextResponse.json(
        { error: "No program assignments found" },
        { status: 403 }
      );
    }

    const guardianLink = await db.athleteGuardian.findFirst({
      where: {
        userId,
        athlete: {
          enrollments: {
            some: { programId: { in: programIds }, status: "ACTIVE" },
          },
          organizationAthletes: { some: { organizationId } },
        },
      },
    });

    if (!guardianLink) {
      return NextResponse.json(
        { error: "User is not connected to your programs" },
        { status: 404 }
      );
    }

    // Channel-specific validation
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { phone: true, phoneVerified: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (channel === "WEB_SMS") {
      if (!user.phone) {
        return NextResponse.json(
          {
            error: "User does not have a phone number",
            code: "NO_PHONE_NUMBER",
          },
          { status: 400 }
        );
      }
      if (!user.phoneVerified) {
        return NextResponse.json(
          {
            error: "User does not have a verified phone number",
            code: "PHONE_NOT_VERIFIED",
          },
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

    const conversationId = await getOrCreateCoachConversation(
      organizationId,
      userId,
      effectiveUser.userId,
      channel
    );

    return NextResponse.json({ success: true, conversationId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error creating coach conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
