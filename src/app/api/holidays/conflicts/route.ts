import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import { parseDateOnly, formatDateOnly } from "@/lib/date-utils";
import { generateInstanceDates } from "@/lib/program-instance-utils";

// GET /api/holidays/conflicts?date=YYYY-MM-DD&action=enable|disable
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const action = searchParams.get("action");

    if (!dateParam || !action) {
      return NextResponse.json(
        { error: "date and action query parameters are required" },
        { status: 400 }
      );
    }
    if (action !== "enable" && action !== "disable") {
      return NextResponse.json(
        { error: 'action must be "enable" or "disable"' },
        { status: 400 }
      );
    }

    const date = parseDateOnly(dateParam);
    if (!date) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const organizationId = session.user.organizationId!;
    const scopedDb = getScopedDb(organizationId);
    const dateStr = formatDateOnly(date);

    if (action === "enable") {
      // Find scheduled program instances on this date
      const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
      const dayEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));

      const instances = await scopedDb.programInstance.findMany({
        where: {
          date: { gte: dayStart, lte: dayEnd },
          status: "SCHEDULED",
        },
        include: {
          program: { select: { id: true, name: true } },
          _count: { select: { registrations: true } },
        },
        orderBy: { startTime: "asc" },
      });

      return NextResponse.json({
        action: "enable",
        date: dateStr,
        instances: instances.map((i) => ({
          id: i.id,
          programId: i.program.id,
          programName: i.program.name,
          startTime: i.startTime,
          endTime: i.endTime,
          registrationCount: i._count.registrations,
        })),
      });
    }

    // action === "disable": find programs that should have an instance on this date but don't
    const programs = await scopedDb.program.findMany({
      where: {
        startDate: { lte: date },
        OR: [{ endDate: null }, { endDate: { gte: date } }],
        startTime: { not: null },
        duration: { not: null },
        status: { in: ["ACTIVE", "INACTIVE"] },
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        rrule: true,
        startTime: true,
        duration: true,
      },
    });

    const missingPrograms: Array<{
      id: string;
      name: string;
      startTime: string;
    }> = [];

    for (const program of programs) {
      if (!program.startDate || !program.startTime) continue;

      const instanceDates = generateInstanceDates(
        program.startDate,
        program.endDate || program.startDate,
        program.rrule
      );

      const wouldHaveInstance = instanceDates.some(
        (d) => formatDateOnly(d) === dateStr
      );
      if (!wouldHaveInstance) continue;

      // Check if an instance already exists for this program on this date
      const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
      const dayEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));

      const existingInstance = await scopedDb.programInstance.findFirst({
        where: {
          programId: program.id,
          date: { gte: dayStart, lte: dayEnd },
        },
      });

      if (!existingInstance) {
        missingPrograms.push({
          id: program.id,
          name: program.name,
          startTime: program.startTime,
        });
      }
    }

    return NextResponse.json({
      action: "disable",
      date: dateStr,
      programs: missingPrograms,
    });
  } catch (error) {
    console.error("Error checking holiday conflicts:", error);
    return NextResponse.json(
      { error: "Failed to check conflicts" },
      { status: 500 }
    );
  }
}
