import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/athletes/[id]/evaluations - Get athlete's evaluations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: athleteId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const permissions = session.user.permissions ?? [];
    const isSuperAdmin = session.user.isSuperAdmin === true;
    const hasStaffAccess =
      isSuperAdmin ||
      permissions.includes("*") ||
      permissions.includes("athletes.view") ||
      permissions.includes("athletes.edit");

    let athlete;
    if (hasStaffAccess) {
      athlete = await db.athlete.findFirst({
        where: {
          id: athleteId,
          organizationAthletes: {
            some: { organizationId: session.user.organizationId },
          },
        },
      });
    } else {
      athlete = await db.athlete.findFirst({
        where: {
          id: athleteId,
          OR: [
            { guardians: { some: { userId: session.user.id } } },
            { userId: session.user.id },
          ],
        },
      });
    }

    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const where = {
      athleteId,
      OR: [
        { program: { organizationId: session.user.organizationId } },
        { programId: null, coach: { memberships: { some: { organizationId: session.user.organizationId } } } },
      ],
      ...(status && { status: status as "PENDING" | "IN_PROGRESS" | "PASS" | "RETRY" | "EXCELLENT" | "SATISFACTORY" }),
      ...(startDate && endDate && {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
    };

    const [evaluations, total] = await Promise.all([
      db.evaluation.findMany({
        where,
        include: {
          coach: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          template: {
            select: {
              id: true,
              name: true,
              levelId: true,
              level: true,
            },
          },
          level: true,
          skillRatings: {
            include: {
              skill: true,
            },
          },
        },
        orderBy: { date: "desc" },
        take: limit,
        skip: offset,
      }),
      db.evaluation.count({ where }),
    ]);

    // Calculate statistics
    const stats = {
      total,
      pending: evaluations.filter((e) => e.status === "PENDING" || e.status === "IN_PROGRESS").length,
      passed: evaluations.filter((e) => e.status === "PASS" || e.status === "EXCELLENT" || e.status === "SATISFACTORY").length,
      retry: evaluations.filter((e) => e.status === "RETRY").length,
    };

    return NextResponse.json({
      data: evaluations,
      stats,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching athlete evaluations:", error);
    return NextResponse.json(
      { error: "Failed to fetch athlete evaluations" },
      { status: 500 }
    );
  }
}
