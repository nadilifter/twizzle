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

    const guardianLinks = await db.athleteGuardian.findMany({
      where: {
        userId: { not: null },
        athlete: { organizationId },
      },
      select: { userId: true },
      distinct: ["userId"],
    });

    const guardianUserIds = guardianLinks
      .map((g) => g.userId)
      .filter((id): id is string => id != null);

    if (guardianUserIds.length === 0) {
      return NextResponse.json({ data: [], total: 0, limit, offset });
    }

    const where: Record<string, unknown> = {
      id: { in: guardianUserIds },
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
          balance: true,
          status: true,
          athleteGuardians: {
            where: { athlete: { organizationId } },
            select: {
              athlete: { select: { id: true, name: true, status: true } },
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
      balance: u.balance,
      status: u.status,
      athletes: u.athleteGuardians.map((ag) => ag.athlete),
    }));

    return NextResponse.json({ data, total, limit, offset });
  } catch (error) {
    console.error("Error fetching guardians:", error);
    return NextResponse.json(
      { error: "Failed to fetch guardians" },
      { status: 500 }
    );
  }
}
