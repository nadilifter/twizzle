import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getCoachConversationGuardians } from "@/lib/conversation-service";
import { getEffectiveUser, getCoachingMemberships } from "@/lib/impersonation";

// GET /api/coach/chat/guardians - List guardians available for new coach conversations
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const effectiveUser = await getEffectiveUser(session);
    if (!effectiveUser) {
      return NextResponse.json({ data: [] });
    }

    const coachingMemberships = await getCoachingMemberships(session);
    if (coachingMemberships.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const search =
      request.nextUrl.searchParams.get("search") || undefined;

    const guardians = await getCoachConversationGuardians(
      effectiveUser.userId,
      coachingMemberships,
      search
    );

    return NextResponse.json({ data: guardians });
  } catch (error) {
    console.error("Error fetching coach chat guardians:", error);
    return NextResponse.json(
      { error: "Failed to fetch guardians" },
      { status: 500 }
    );
  }
}
