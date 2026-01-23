import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createAttendanceSchema = z.object({
  athleteId: z.string().min(1, "Athlete is required"),
  eventId: z.string().min(1, "Event is required"),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]).default("PRESENT"),
  notes: z.string().optional(),
});

const bulkAttendanceSchema = z.object({
  eventId: z.string().min(1, "Event is required"),
  attendances: z.array(z.object({
    athleteId: z.string().min(1),
    status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
    notes: z.string().optional(),
  })),
});

// GET /api/attendance
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const athleteId = searchParams.get("athleteId");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = {
      event: {
        organizationId: session.user.organizationId,
      },
      ...(eventId && { eventId }),
      ...(athleteId && { athleteId }),
      ...(status && { status: status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" }),
      ...(startDate && endDate && {
        event: {
          organizationId: session.user.organizationId,
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
      }),
    };

    const [attendances, total] = await Promise.all([
      db.attendance.findMany({
        where,
        include: {
          athlete: {
            select: {
              id: true,
              name: true,
              level: true,
              group: true,
              family: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              date: true,
              startTime: true,
              endTime: true,
              type: true,
              program: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.attendance.count({ where }),
    ]);

    return NextResponse.json({
      data: attendances,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance" },
      { status: 500 }
    );
  }
}

// POST /api/attendance - Single or bulk attendance
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("events.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Check if bulk or single
    if (body.attendances) {
      // Bulk attendance
      const validatedData = bulkAttendanceSchema.parse(body);

      // Verify event
      const event = await db.event.findFirst({
        where: {
          id: validatedData.eventId,
          organizationId: session.user.organizationId,
        },
      });

      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }

      // Upsert attendances
      const results = await Promise.all(
        validatedData.attendances.map(async (att) => {
          return db.attendance.upsert({
            where: {
              athleteId_eventId: {
                athleteId: att.athleteId,
                eventId: validatedData.eventId,
              },
            },
            update: {
              status: att.status,
              notes: att.notes,
              checkedIn: att.status === "PRESENT" ? new Date() : null,
            },
            create: {
              athleteId: att.athleteId,
              eventId: validatedData.eventId,
              status: att.status,
              notes: att.notes,
              checkedIn: att.status === "PRESENT" ? new Date() : null,
            },
          });
        })
      );

      return NextResponse.json({ success: true, count: results.length });
    } else {
      // Single attendance
      const validatedData = createAttendanceSchema.parse(body);

      // Verify event
      const event = await db.event.findFirst({
        where: {
          id: validatedData.eventId,
          organizationId: session.user.organizationId,
        },
      });

      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }

      // Verify athlete
      const athlete = await db.athlete.findFirst({
        where: {
          id: validatedData.athleteId,
          family: {
            organizationId: session.user.organizationId,
          },
        },
      });

      if (!athlete) {
        return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
      }

      const attendance = await db.attendance.upsert({
        where: {
          athleteId_eventId: {
            athleteId: validatedData.athleteId,
            eventId: validatedData.eventId,
          },
        },
        update: {
          status: validatedData.status,
          notes: validatedData.notes,
          checkedIn: validatedData.status === "PRESENT" ? new Date() : null,
        },
        create: {
          athleteId: validatedData.athleteId,
          eventId: validatedData.eventId,
          status: validatedData.status,
          notes: validatedData.notes,
          checkedIn: validatedData.status === "PRESENT" ? new Date() : null,
        },
        include: {
          athlete: true,
          event: true,
        },
      });

      return NextResponse.json(attendance);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating attendance:", error);
    return NextResponse.json(
      { error: "Failed to record attendance" },
      { status: 500 }
    );
  }
}
