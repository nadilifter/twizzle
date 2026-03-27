import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

// ISO weekday (0=Mon..6=Sun) to JS Date.getDay() (0=Sun..6=Sat)
function isoWeekdayToJsDay(iso: number): number {
  return iso === 6 ? 0 : iso + 1;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Returns all spaces for a facility with their current booking
 * availability. For recurring programs, accepts a date range and days
 * of the week, then returns per-date conflict info so the UI can show
 * which specific dates have capacity issues.
 *
 * Query params:
 *   startTime, endTime    - time window (HH:MM)
 *   daysOfWeek            - comma-separated ISO weekdays (0=Mon..6=Sun)
 *   programStartDate      - program date range start (ISO date)
 *   programEndDate        - program date range end (ISO date)
 *   excludeProgramId      - exclude a program from conflict checks (edits)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { error: "No organization selected" },
        { status: 400 }
      );
    }

    const { id: facilityId } = await params;
    const { searchParams } = new URL(request.url);
    const startTime = searchParams.get("startTime");
    const endTime = searchParams.get("endTime");
    const daysOfWeekParam = searchParams.get("daysOfWeek");
    const programStartDate = searchParams.get("programStartDate");
    const programEndDate = searchParams.get("programEndDate");
    const excludeProgramId = searchParams.get("excludeProgramId");

    const facility = await db.facility.findFirst({
      where: { id: facilityId, organizationId },
    });

    if (!facility) {
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 }
      );
    }

    const spaces = await db.space.findMany({
      where: { facilityId, status: "OPEN" },
      include: {
        availability: true,
        _count: { select: { equipment: true } },
      },
      orderBy: { name: "asc" },
    });

    const hasTimeSlot = startTime && endTime;

    // Convert ISO weekday params to JS day-of-week values for filtering
    let jsDays: number[] = [];
    if (daysOfWeekParam) {
      jsDays = daysOfWeekParam
        .split(",")
        .map((d) => isoWeekdayToJsDay(parseInt(d.trim())));
    }

    // Per-space, per-date used capacity: { spaceId -> { "2026-03-05" -> usedCapacity } }
    const usedCapacityBySpaceDate: Record<string, Record<string, number>> = {};

    if (hasTimeSlot) {
      const spaceIds = spaces.map((s) => s.id);

      if (spaceIds.length > 0) {
        const excludeFilter = excludeProgramId
          ? { programId: { not: excludeProgramId } }
          : {};

        // Scope to the program's date range if provided
        const dateRangeFilter: Record<string, any> = {};
        if (programStartDate) dateRangeFilter.date = { ...dateRangeFilter.date, gte: new Date(programStartDate) };
        if (programEndDate) dateRangeFilter.date = { ...dateRangeFilter.date, lte: new Date(programEndDate) };

        const instanceSpaceAssignments =
          await db.programInstanceSpace.findMany({
            where: {
              spaceId: { in: spaceIds },
              programInstance: {
                status: "SCHEDULED",
                startTime: { lt: endTime },
                endTime: { gt: startTime },
                ...dateRangeFilter,
                ...excludeFilter,
              },
            },
            include: {
              programInstance: {
                select: { capacity: true, date: true },
              },
            },
          });

        for (const a of instanceSpaceAssignments) {
          const instDate = new Date(a.programInstance.date);
          if (jsDays.length > 0 && !jsDays.includes(instDate.getDay())) continue;
          const key = toDateKey(instDate);
          usedCapacityBySpaceDate[a.spaceId] ??= {};
          usedCapacityBySpaceDate[a.spaceId][key] =
            (usedCapacityBySpaceDate[a.spaceId][key] ?? 0) +
            (a.programInstance.capacity ?? 0);
        }

        // Program-level space assignments for instances without overrides
        const programSpaceAssignments = await db.programSpace.findMany({
          where: {
            spaceId: { in: spaceIds },
            program: {
              instances: {
                some: {
                  status: "SCHEDULED",
                  startTime: { lt: endTime },
                  endTime: { gt: startTime },
                  ...dateRangeFilter,
                  ...excludeFilter,
                  spaces: { none: {} },
                },
              },
            },
          },
          include: {
            program: {
              select: {
                instances: {
                  where: {
                    status: "SCHEDULED",
                    startTime: { lt: endTime },
                    endTime: { gt: startTime },
                    ...dateRangeFilter,
                    ...excludeFilter,
                    spaces: { none: {} },
                  },
                  select: { capacity: true, date: true },
                },
              },
            },
          },
        });

        for (const a of programSpaceAssignments) {
          for (const inst of a.program.instances) {
            const instDate = new Date(inst.date);
            if (jsDays.length > 0 && !jsDays.includes(instDate.getDay())) continue;
            const key = toDateKey(instDate);
            usedCapacityBySpaceDate[a.spaceId] ??= {};
            usedCapacityBySpaceDate[a.spaceId][key] =
              (usedCapacityBySpaceDate[a.spaceId][key] ?? 0) +
              (inst.capacity ?? 0);
          }
        }
      }
    }

    const result = spaces.map((space) => {
      const maxCapacity = space.capacity;
      const perDate = usedCapacityBySpaceDate[space.id] ?? {};

      // Build conflict dates list - dates where space is at capacity
      const conflictDates: Array<{ date: string; used: number; available: number }> = [];
      for (const [dateKey, used] of Object.entries(perDate)) {
        const available = maxCapacity != null ? Math.max(0, maxCapacity - used) : null;
        if (maxCapacity != null && available != null && available <= 0) {
          conflictDates.push({ date: dateKey, used, available });
        }
      }
      conflictDates.sort((a, b) => a.date.localeCompare(b.date));

      // Aggregate stats
      const allUsed = Object.values(perDate);
      const worstUsed = allUsed.length > 0 ? Math.max(...allUsed) : 0;
      const availableCapacity =
        maxCapacity != null ? Math.max(0, maxCapacity - worstUsed) : null;

      // "Fully booked" means every single overlapping date is at capacity
      // For practical purposes: if there are conflicts AND worst-case is at capacity
      const totalDatesWithBookings = Object.keys(perDate).length;
      const isFullyBooked =
        maxCapacity != null &&
        availableCapacity != null &&
        availableCapacity <= 0 &&
        conflictDates.length > 0 &&
        conflictDates.length === totalDatesWithBookings;

      // Availability window check - identify days the space is closed or
      // outside operating hours for the requested time slot
      const JS_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const closedDays: Array<{ day: string; reason: string }> = [];

      if (space.availability.length > 0) {
        const daysToCheck = jsDays.length > 0 ? jsDays : (hasTimeSlot ? [0, 1, 2, 3, 4, 5, 6] : []);
        for (const jsDay of daysToCheck) {
          const daySlot = space.availability.find((a) => a.dayOfWeek === jsDay);
          if (!daySlot) {
            closedDays.push({
              day: JS_DAY_LABELS[jsDay],
              reason: "closed",
            });
          } else if (
            hasTimeSlot &&
            (startTime < daySlot.openTime || endTime! > daySlot.closeTime)
          ) {
            closedDays.push({
              day: JS_DAY_LABELS[jsDay],
              reason: `open ${daySlot.openTime}–${daySlot.closeTime}`,
            });
          }
        }
      }

      return {
        id: space.id,
        name: space.name,
        capacity: space.capacity,
        status: space.status,
        description: space.description,
        availability: space.availability,
        maxCapacity,
        availableCapacity,
        isAvailable: closedDays.length === 0,
        isFullyBooked,
        conflictDates,
        totalConflicts: conflictDates.length,
        closedDays,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching space availability:", error);
    return NextResponse.json(
      { error: "Failed to fetch space availability" },
      { status: 500 }
    );
  }
}
