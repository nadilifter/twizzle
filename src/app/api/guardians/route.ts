import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const organizationId = session.user.organizationId;

    // Get user IDs from two sources and union them:
    // 1. PARENT org members (includes invited guardians who haven't added athletes yet)
    // 2. AthleteGuardian links to org athletes (catches guardians without PARENT membership)
    const [parentMembers, guardianLinks] = await Promise.all([
      db.organizationMember.findMany({
        where: { organizationId, role: "PARENT" },
        select: { userId: true },
      }),
      db.athleteGuardian.findMany({
        where: {
          userId: { not: null },
          athlete: {
            organizationAthletes: { some: { organizationId } },
          },
        },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ]);

    const allUserIds = [
      ...new Set([
        ...parentMembers.map((m) => m.userId),
        ...guardianLinks.map((g) => g.userId).filter((id): id is string => id != null),
      ]),
    ];

    if (allUserIds.length === 0) {
      return NextResponse.json({ data: [], total: 0, limit, offset });
    }

    const where: Record<string, unknown> = {
      id: { in: allUserIds },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          phoneVerified: true,
          balance: true,
          status: true,
          memberships: {
            where: { organizationId, role: "PARENT" },
            select: { status: true },
            take: 1,
          },
          athleteGuardians: {
            where: {
              athlete: {
                organizationAthletes: { some: { organizationId } },
              },
            },
            select: {
              athlete: { select: { id: true, name: true } },
              isPrimary: true,
            },
          },
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      db.user.count({ where }),
    ]);

    const data = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      phoneVerified: u.phoneVerified,
      balance: u.balance,
      status: u.status,
      memberStatus: u.memberships[0]?.status ?? null,
      athletes: u.athleteGuardians.map((ag) => ag.athlete),
    }));

    return NextResponse.json({ data, total, limit, offset });
  } catch (error) {
    console.error("Error fetching guardians:", error);
    return NextResponse.json({ error: "Failed to fetch guardians" }, { status: 500 });
  }
}
