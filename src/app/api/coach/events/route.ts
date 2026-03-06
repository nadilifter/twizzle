import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveUser, getCoachingMemberships } from "@/lib/impersonation";

// GET /api/coach/events
// Returns events assigned to the current coach across all coaching organizations
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const effectiveUser = await getEffectiveUser(session);
    if (!effectiveUser) {
      return NextResponse.json({ data: [], total: 0 });
    }

    const { userId } = effectiveUser;
    const coachingMemberships = await getCoachingMemberships(session);
    if (coachingMemberships.length === 0) {
      return NextResponse.json({ data: [], total: 0 });
    }

    const orgIds = coachingMemberships.map((m) => m.organizationId);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type");
    const programId = searchParams.get("programId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {
      coachId: userId,
      organizationId: { in: orgIds },
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(type && { type }),
      ...(programId && { programId }),
      ...(startDate && endDate && {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
    };

    const [events, total] = await Promise.all([
      db.event.findMany({
        where,
        include: {
          program: { select: { id: true, name: true } },
          facility: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true } },
          staffAssignments: {
            include: {
              member: {
                include: {
                  user: { select: { id: true, name: true, avatar: true } },
                },
              },
            },
          },
          _count: {
            select: {
              attendances: true,
            },
          },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: limit,
        skip: offset,
      }),
      db.event.count({ where }),
    ]);

    return NextResponse.json({
      data: events,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching coach events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
