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
 * Returns all training zones for a facility with their current booking
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

    const zones = await db.trainingZone.findMany({
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

    // Per-zone, per-date used capacity: { zoneId -> { "2026-03-05" -> usedCapacity } }
    const usedCapacityByZoneDate: Record<string, Record<string, number>> = {};

    if (hasTimeSlot) {
      const zoneIds = zones.map((z) => z.id);

      if (zoneIds.length > 0) {
        const excludeFilter = excludeProgramId
          ? { programId: { not: excludeProgramId } }
          : {};

        // Scope to the program's date range if provided
        const dateRangeFilter: Record<string, any> = {};
        if (programStartDate) dateRangeFilter.date = { ...dateRangeFilter.date, gte: new Date(programStartDate) };
        if (programEndDate) dateRangeFilter.date = { ...dateRangeFilter.date, lte: new Date(programEndDate) };

        const instanceZoneAssignments =
          await db.programInstanceTrainingZone.findMany({
            where: {
              trainingZoneId: { in: zoneIds },
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

        for (const a of instanceZoneAssignments) {
          const instDate = new Date(a.programInstance.date);
          if (jsDays.length > 0 && !jsDays.includes(instDate.getDay())) continue;
          const key = toDateKey(instDate);
          usedCapacityByZoneDate[a.trainingZoneId] ??= {};
          usedCapacityByZoneDate[a.trainingZoneId][key] =
            (usedCapacityByZoneDate[a.trainingZoneId][key] ?? 0) +
            (a.programInstance.capacity ?? 0);
        }

        // Program-level zone assignments for instances without overrides
        const programZoneAssignments = await db.programTrainingZone.findMany({
          where: {
            trainingZoneId: { in: zoneIds },
            program: {
              instances: {
                some: {
                  status: "SCHEDULED",
                  startTime: { lt: endTime },
                  endTime: { gt: startTime },
                  ...dateRangeFilter,
                  ...excludeFilter,
                  trainingZones: { none: {} },
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
                    trainingZones: { none: {} },
                  },
                  select: { capacity: true, date: true },
                },
              },
            },
          },
        });

        for (const a of programZoneAssignments) {
          for (const inst of a.program.instances) {
            const instDate = new Date(inst.date);
            if (jsDays.length > 0 && !jsDays.includes(instDate.getDay())) continue;
            const key = toDateKey(instDate);
            usedCapacityByZoneDate[a.trainingZoneId] ??= {};
            usedCapacityByZoneDate[a.trainingZoneId][key] =
              (usedCapacityByZoneDate[a.trainingZoneId][key] ?? 0) +
              (inst.capacity ?? 0);
          }
        }
      }
    }

    const result = zones.map((zone) => {
      const maxCapacity = zone.capacity;
      const perDate = usedCapacityByZoneDate[zone.id] ?? {};

      // Build conflict dates list - dates where zone is at capacity
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

      // Availability window check
      let isAvailable = true;
      if (jsDays.length > 0 && zone.availability.length > 0) {
        let unavailableCount = 0;
        for (const jsDay of jsDays) {
          const daySlot = zone.availability.find((a) => a.dayOfWeek === jsDay);
          if (!daySlot) {
            unavailableCount++;
          } else if (
            hasTimeSlot &&
            (startTime < daySlot.openTime || endTime! > daySlot.closeTime)
          ) {
            unavailableCount++;
          }
        }
        // Only mark unavailable if ALL days are outside hours
        isAvailable = unavailableCount < jsDays.length;
      }

      return {
        id: zone.id,
        name: zone.name,
        type: zone.type,
        capacity: zone.capacity,
        status: zone.status,
        description: zone.description,
        availability: zone.availability,
        maxCapacity,
        availableCapacity,
        isAvailable,
        isFullyBooked,
        conflictDates,
        totalConflicts: conflictDates.length,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching training zone availability:", error);
    return NextResponse.json(
      { error: "Failed to fetch training zone availability" },
      { status: 500 }
    );
  }
}
