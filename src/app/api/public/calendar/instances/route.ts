import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";

// GET /api/public/calendar/instances - Get program instances for public calendar view
// No auth required - resolves organization from site slug
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Slug is required for public access
    const slug = searchParams.get("slug");
    if (!slug) {
      return NextResponse.json(
        { error: "slug parameter is required" },
        { status: 400 }
      );
    }

    // Look up organization by subdomain
    const config = await db.websiteConfig.findUnique({
      where: { subdomain: slug },
      select: { organizationId: true },
    });

    if (!config) {
      return NextResponse.json(
        { error: "Site not found" },
        { status: 404 }
      );
    }

    // Date range parameters
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    // Default to current month +/- 1 month if no dates provided
    const now = new Date();
    const start = startParam
      ? new Date(startParam)
      : startOfMonth(subMonths(now, 1));
    const end = endParam
      ? new Date(endParam)
      : endOfMonth(addMonths(now, 1));

    const instances = await db.programInstance.findMany({
      where: {
        organizationId: config.organizationId,
        date: {
          gte: start,
          lte: end,
        },
        status: "SCHEDULED",
        program: {
          status: "ACTIVE",
        },
      },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            color: true,
            registrationType: true,
            capacity: true,
            hasCapacityRestriction: true,
            waitlistEnabled: true,
            waitlistCapacity: true,
            hasAgeRestriction: true,
            minAge: true,
            maxAge: true,
            hasLevelRestriction: true,
            seasonId: true,
            levelRequirements: {
              select: { levelId: true },
            },
            staffAssignments: {
              where: { role: { in: ["LEAD_COACH", "ASSISTANT_COACH"] } },
              select: { member: { select: { user: { select: { id: true } } } } },
            },
          },
        },
        facility: {
          select: { id: true, name: true, city: true },
        },
        _count: {
          select: { registrations: { where: { status: "REGISTERED" } } },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    // Collect unique program IDs for batch enrollment lookups
    const programIds = [...new Set(instances.map((i) => i.programId))];

    // Batch-fetch program-level enrollment counts (non-waitlisted) for ALL_INSTANCES programs
    const enrollmentCounts = programIds.length > 0
      ? await db.enrollment.groupBy({
          by: ["programId"],
          where: {
            programId: { in: programIds },
            status: { not: "WAITLISTED" },
          },
          _count: true,
        })
      : [];
    const enrollmentMap = new Map(enrollmentCounts.map((e) => [e.programId, e._count]));

    // Batch-fetch waitlisted enrollment counts
    const waitlistCounts = programIds.length > 0
      ? await db.enrollment.groupBy({
          by: ["programId"],
          where: {
            programId: { in: programIds },
            status: "WAITLISTED",
          },
          _count: true,
        })
      : [];
    const waitlistMap = new Map(waitlistCounts.map((w) => [w.programId, w._count]));

    const events = instances.map((instance) => {
      const prog = instance.program;
      const isDropIn = prog.registrationType === "PER_INSTANCE";

      let isSoldOut = false;
      let isWaitlistAvailable = false;

      if (prog.hasCapacityRestriction && prog.capacity != null && prog.capacity > 0) {
        if (isDropIn) {
          const instCap = instance.capacity ?? prog.capacity;
          const instFull = instance._count.registrations >= instCap;
          if (instFull) {
            if (prog.waitlistEnabled) {
              const wlCount = waitlistMap.get(instance.programId) || 0;
              isWaitlistAvailable = prog.waitlistCapacity == null || wlCount < prog.waitlistCapacity;
            }
            isSoldOut = !isWaitlistAvailable;
          }
        } else {
          const enrolled = enrollmentMap.get(instance.programId) || 0;
          const progFull = enrolled >= prog.capacity;
          if (progFull) {
            if (prog.waitlistEnabled) {
              const wlCount = waitlistMap.get(instance.programId) || 0;
              isWaitlistAvailable = prog.waitlistCapacity == null || wlCount < prog.waitlistCapacity;
            }
            isSoldOut = !isWaitlistAvailable;
          }
        }
      }

      return {
        id: instance.id,
        title: prog.name,
        start: instance.date,
        startTime: instance.startTime,
        endTime: instance.endTime,
        status: instance.status,
        programId: instance.programId,
        programName: prog.name,
        facilityId: instance.facilityId,
        facilityName: instance.facility?.name || null,
        capacity: null,
        registrationCount: 0,
        attendanceCount: 0,
        color: prog.color,
        levelName: null,
        registrationType: prog.registrationType,
        isSoldOut,
        isWaitlistAvailable,
        hasAgeRestriction: prog.hasAgeRestriction,
        minAge: prog.minAge,
        maxAge: prog.maxAge,
        hasLevelRestriction: prog.hasLevelRestriction,
        levelIds: prog.levelRequirements.map((lr) => lr.levelId),
        coachIds: prog.staffAssignments.map((sa) => sa.member.user.id),
        seasonId: prog.seasonId,
      };
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error fetching public calendar instances:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar instances" },
      { status: 500 }
    );
  }
}
