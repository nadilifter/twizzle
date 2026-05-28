import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveUser, getCoachingMemberships } from "@/lib/impersonation";
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const effectiveUser = await getEffectiveUser(session);
    if (!effectiveUser) {
      return NextResponse.json({ error: "No user context" }, { status: 400 });
    }

    const { userId } = effectiveUser;
    const coachingMemberships = await getCoachingMemberships(session);
    if (coachingMemberships.length === 0) {
      return NextResponse.json({
        todayEvents: [],
        todayEventCount: 0,
        weekEventCount: 0,
        pendingAttendanceCount: 0,
        programs: [],
        programCount: 0,
        upcomingCompetitions: [],
        competitionCount: 0,
        nextEvent: null,
        organizations: [],
      });
    }

    const orgIds = coachingMemberships.map((m) => m.organizationId);
    const memberIds = coachingMemberships.map((m) => m.memberId);

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

    // Find programs via ProgramStaff assignments across all coaching orgs
    const programStaffAssignments = await db.programStaff.findMany({
      where: { memberId: { in: memberIds } },
      select: { programId: true },
    });

    const coachEventPrograms = await db.event.findMany({
      where: {
        coachId: userId,
        organizationId: { in: orgIds },
        programId: { not: null },
      },
      select: { programId: true },
      distinct: ["programId"],
    });

    const allProgramIds = Array.from(
      new Set([
        ...programStaffAssignments.map((a) => a.programId),
        ...coachEventPrograms.map((e) => e.programId).filter((id): id is string => id !== null),
      ])
    );

    const [
      todayEvents,
      weekEventCount,
      activePrograms,
      upcomingCompetitions,
      pendingAttendanceEvents,
    ] = await Promise.all([
      db.event.findMany({
        where: {
          coachId: userId,
          organizationId: { in: orgIds },
          date: { gte: todayStart, lte: todayEnd },
        },
        include: {
          program: { select: { id: true, name: true } },
          facility: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true } },
          _count: { select: { attendances: true } },
        },
        orderBy: { startTime: "asc" },
      }),

      db.event.count({
        where: {
          coachId: userId,
          organizationId: { in: orgIds },
          date: { gte: weekStart, lte: weekEnd },
        },
      }),

      allProgramIds.length > 0
        ? db.program.findMany({
            where: {
              id: { in: allProgramIds },
              organizationId: { in: orgIds },
              status: { in: ["ACTIVE", "COMPLETE"] },
            },
            select: {
              id: true,
              name: true,
              organizationId: true,
              organization: { select: { name: true } },
              _count: {
                select: {
                  enrollments: { where: { status: "ACTIVE" } },
                  events: true,
                },
              },
            },
            orderBy: { name: "asc" },
          })
        : [],

      db.competition.findMany({
        where: {
          organizationId: { in: orgIds },
          startDate: { gte: todayStart },
          status: { in: ["PUBLISHED", "REGISTRATION_OPEN"] },
        },
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
          startTime: true,
          city: true,
          stateProvince: true,
          facility: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true } },
          _count: { select: { entries: true, categories: true } },
        },
        orderBy: { startDate: "asc" },
        take: 5,
      }),

      db.event.findMany({
        where: {
          coachId: userId,
          organizationId: { in: orgIds },
          date: { gte: todayStart, lte: todayEnd },
          attendances: { none: {} },
        },
        select: { id: true },
      }),
    ]);

    const nextEvent = await db.event.findFirst({
      where: {
        coachId: userId,
        organizationId: { in: orgIds },
        date: { gte: todayStart },
      },
      include: {
        program: { select: { id: true, name: true } },
        facility: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        _count: { select: { attendances: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({
      todayEvents: todayEvents.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        type: e.type,
        program: e.program,
        facility: e.facility,
        organization: e.organization,
        attendanceCount: e._count.attendances,
      })),
      todayEventCount: todayEvents.length,
      weekEventCount,
      pendingAttendanceCount: pendingAttendanceEvents.length,
      programs: activePrograms.map((p) => ({
        id: p.id,
        name: p.name,
        organizationId: p.organizationId,
        organizationName: p.organization.name,
        enrollmentCount: p._count.enrollments,
        eventCount: p._count.events,
      })),
      programCount: activePrograms.length,
      upcomingCompetitions: upcomingCompetitions.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        startTime: c.startTime,
        city: c.city,
        stateProvince: c.stateProvince,
        facility: c.facility,
        organization: c.organization,
        entryCount: c._count.entries,
        categoryCount: c._count.categories,
      })),
      competitionCount: upcomingCompetitions.length,
      nextEvent: nextEvent
        ? {
            id: nextEvent.id,
            title: nextEvent.title,
            date: nextEvent.date,
            startTime: nextEvent.startTime,
            endTime: nextEvent.endTime,
            type: nextEvent.type,
            program: nextEvent.program,
            facility: nextEvent.facility,
            organization: nextEvent.organization,
            attendanceCount: nextEvent._count.attendances,
          }
        : null,
      organizations: coachingMemberships.map((m) => ({
        id: m.organizationId,
        name: m.organizationName,
      })),
    });
  } catch (error) {
    console.error("Error fetching coach overview:", error);
    return NextResponse.json({ error: "Failed to fetch overview data" }, { status: 500 });
  }
}
