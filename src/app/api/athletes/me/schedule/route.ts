import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { RRule } from "rrule";
import { format, addMinutes, addDays } from "date-fns";

export interface ScheduleEvent {
  id: string;
  athleteId: string;
  athleteFirstName: string;
  athleteLastName: string;
  type: "instance" | "competition" | "enrollment";
  title: string;
  organizationName: string;
  date: string; // ISO date string
  startTime: string | null; // "HH:mm"
  endTime: string | null; // "HH:mm"
  status: string;
  facilityName: string | null;
}

function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const startDateObj = new Date(2000, 0, 1, hours, minutes);
  const endDateObj = addMinutes(startDateObj, durationMinutes);
  return format(endDateObj, "HH:mm");
}

function resolveRruleDates(
  rruleString: string,
  programStartDate: Date,
  windowStart: Date,
  windowEnd: Date,
  programEndDate?: Date | null
): Date[] {
  try {
    const effectiveEnd = programEndDate && programEndDate < windowEnd ? programEndDate : windowEnd;
    const effectiveStart = programStartDate > windowStart ? programStartDate : windowStart;
    if (effectiveStart >= effectiveEnd) return [];

    const cleanRrule = rruleString.startsWith("RRULE:") ? rruleString.slice(6) : rruleString;
    const rruleWithDtstart = `DTSTART:${format(programStartDate, "yyyyMMdd'T'HHmmss'Z'")}\nRRULE:${cleanRrule}`;
    const rule = RRule.fromString(rruleWithDtstart);
    return rule.between(effectiveStart, effectiveEnd, true);
  } catch (error) {
    console.error("Error parsing RRULE:", error);
    return [];
  }
}

/**
 * GET /api/athletes/me/schedule
 *
 * Returns a unified schedule for all athletes the current user has access to.
 * Aggregates ProgramInstance sessions, CompetitionEntry dates, and
 * RRULE-resolved enrollment schedules into a sorted list of events.
 *
 * Query params:
 *   days - number of days to look ahead (default 30, max 90)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Support superadmin impersonation: use viewingAsUserId if set
    const userId = (session.user.isSuperAdmin && session.user.viewingAsUserId)
      ? session.user.viewingAsUserId
      : session.user.id;

    const { searchParams } = new URL(request.url);
    const daysParam = Math.min(Math.max(parseInt(searchParams.get("days") || "30") || 30, 1), 90);

    const now = new Date();
    const windowEnd = addDays(now, daysParam);

    // Get all athletes for this user (same logic as /api/athletes/me)
    const userGuardianLinks = await db.athleteGuardian.findMany({
      where: { userId },
      select: { athleteId: true, athlete: { select: { id: true, firstName: true, lastName: true } } },
    });

    const selfAthletes = await db.athlete.findMany({
      where: { userId },
      select: { id: true, firstName: true, lastName: true },
    });

    const athleteMap = new Map<string, { id: string; firstName: string; lastName: string }>();
    for (const link of userGuardianLinks) {
      athleteMap.set(link.athlete.id, link.athlete);
    }
    for (const a of selfAthletes) {
      athleteMap.set(a.id, a);
    }

    const athleteIds = Array.from(athleteMap.keys());
    if (athleteIds.length === 0) {
      return NextResponse.json({ events: [] });
    }

    const events: ScheduleEvent[] = [];

    // 1. ProgramInstance sessions via InstanceRegistration
    const instanceRegistrations = await db.instanceRegistration.findMany({
      where: {
        athleteId: { in: athleteIds },
        status: { not: "CANCELLED" },
        programInstance: {
          date: { gte: now, lte: windowEnd },
          status: "SCHEDULED",
        },
      },
      include: {
        programInstance: {
          include: {
            program: { select: { name: true } },
            facility: { select: { name: true } },
            organization: { select: { name: true } },
          },
        },
      },
    });

    for (const reg of instanceRegistrations) {
      const inst = reg.programInstance;
      const athlete = athleteMap.get(reg.athleteId);
      if (!athlete) continue;
      events.push({
        id: `inst-${reg.id}`,
        athleteId: reg.athleteId,
        athleteFirstName: athlete.firstName,
        athleteLastName: athlete.lastName,
        type: "instance",
        title: inst.program?.name || "Session",
        organizationName: inst.organization?.name || "",
        date: inst.date.toISOString(),
        startTime: inst.startTime,
        endTime: inst.endTime,
        status: reg.status,
        facilityName: inst.facility?.name || null,
      });
    }

    // 2. CompetitionEntry dates
    const competitionEntries = await db.competitionEntry.findMany({
      where: {
        athleteId: { in: athleteIds },
        status: { notIn: ["WITHDRAWN", "SCRATCHED", "REJECTED"] },
        competition: {
          startDate: { lte: windowEnd },
          endDate: { gte: now },
        },
      },
      select: {
        id: true,
        athleteId: true,
        status: true,
        competition: {
          select: {
            name: true,
            startDate: true,
            endDate: true,
            startTime: true,
            endTime: true,
            organization: { select: { name: true } },
            facility: { select: { name: true } },
          },
        },
      },
    });

    for (const entry of competitionEntries) {
      const comp = entry.competition;
      const athlete = athleteMap.get(entry.athleteId);
      if (!athlete) continue;
      events.push({
        id: `comp-${entry.id}`,
        athleteId: entry.athleteId,
        athleteFirstName: athlete.firstName,
        athleteLastName: athlete.lastName,
        type: "competition",
        title: comp.name,
        organizationName: comp.organization?.name || "",
        date: comp.startDate.toISOString(),
        startTime: comp.startTime || null,
        endTime: comp.endTime || null,
        status: entry.status,
        facilityName: comp.facility?.name || null,
      });
    }

    // 3. Enrollment RRULE resolution
    const enrollments = await db.enrollment.findMany({
      where: {
        athleteId: { in: athleteIds },
        status: "ACTIVE",
        program: {
          rrule: { not: null },
          startDate: { not: null },
          startTime: { not: null },
        },
      },
      include: {
        program: {
          select: {
            name: true,
            rrule: true,
            startDate: true,
            endDate: true,
            startTime: true,
            duration: true,
            organization: { select: { name: true } },
            facility: { select: { name: true } },
          },
        },
      },
    });

    for (const enrollment of enrollments) {
      const prog = enrollment.program;
      if (!prog.rrule || !prog.startDate || !prog.startTime) continue;
      const athlete = athleteMap.get(enrollment.athleteId);
      if (!athlete) continue;

      const dates = resolveRruleDates(prog.rrule, prog.startDate, now, windowEnd, prog.endDate);
      const endTime = prog.duration ? calculateEndTime(prog.startTime, prog.duration) : null;

      for (const date of dates) {
        events.push({
          id: `enroll-${enrollment.id}-${date.toISOString()}`,
          athleteId: enrollment.athleteId,
          athleteFirstName: athlete.firstName,
          athleteLastName: athlete.lastName,
          type: "enrollment",
          title: prog.name,
          organizationName: prog.organization?.name || "",
          date: date.toISOString(),
          startTime: prog.startTime,
          endTime,
          status: enrollment.status,
          facilityName: prog.facility?.name || null,
        });
      }
    }

    // Sort by date ascending
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({ events });
  } catch (error) {
    console.error("GET /api/athletes/me/schedule error:", error);
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}
