import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { generateInstanceDates, calculateEndTime } from "@/lib/program-instance-utils";
import { getEnabledHolidayDates, filterOutHolidayDates } from "@/lib/holiday-utils";

const createInstanceSchema = z.object({
  date: z.string(),
  startTime: z.string(),
  endTime: z.string().optional(),
  duration: z.number().int().min(1).optional(),
  facilityId: z.string().optional().nullable(),
  capacity: z.number().int().min(1).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const bulkGenerateSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  rrule: z.string(),
  startTime: z.string(),
  duration: z.number().int().min(1),
  facilityId: z.string().optional().nullable(),
  capacity: z.number().int().min(1).optional().nullable(),
});

// GET /api/programs/[id]/instances
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: programId } = await params;
    const { searchParams } = new URL(request.url);

    // Query parameters
    const status = searchParams.get("status");
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Verify program exists and belongs to organization
    const program = await db.program.findFirst({
      where: {
        id: programId,
        organizationId: session.user.organizationId,
      },
    });

    if (!program) {
      const existsElsewhere = await db.program.findFirst({
        where: { id: programId },
        select: { id: true },
      });
      if (existsElsewhere) {
        return NextResponse.json(
          { error: "This program belongs to a different organization", code: "ORG_MISMATCH" },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    // Build where clause
    const where: any = {
      programId,
      organizationId: session.user.organizationId,
    };

    if (status) {
      where.status = status;
    }

    if (fromDate) {
      where.date = { ...where.date, gte: new Date(fromDate) };
    }

    if (toDate) {
      where.date = { ...where.date, lte: new Date(toDate) };
    }

    const [instances, total] = await Promise.all([
      db.programInstance.findMany({
        where,
        include: {
          facility: {
            select: { id: true, name: true, city: true },
          },
          _count: {
            select: { registrations: true, attendances: true },
          },
        },
        orderBy: { date: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.programInstance.count({ where }),
    ]);

    return NextResponse.json({
      instances,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching instances:", error);
    return NextResponse.json({ error: "Failed to fetch instances" }, { status: 500 });
  }
}

// POST /api/programs/[id]/instances
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: programId } = await params;
    const body = await request.json();

    // Verify program exists and belongs to organization
    const program = await db.program.findFirst({
      where: {
        id: programId,
        organizationId: session.user.organizationId,
      },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    // Check if this is a bulk generation or single instance creation
    if (body.rrule) {
      // Bulk generate from RRULE
      const validated = bulkGenerateSchema.parse(body);
      const startDate = new Date(validated.startDate);
      const endDate = new Date(validated.endDate);
      const endTime = calculateEndTime(validated.startTime, validated.duration);

      const allDates = generateInstanceDates(startDate, endDate, validated.rrule);
      const holidayDates = await getEnabledHolidayDates(
        session.user.organizationId!,
        startDate,
        endDate
      );
      const dates = filterOutHolidayDates(allDates, holidayDates);

      if (dates.length === 0) {
        return NextResponse.json(
          { error: "No dates generated from the provided pattern" },
          { status: 400 }
        );
      }

      const instances = await db.programInstance.createMany({
        data: dates.map((date) => ({
          programId,
          date,
          startTime: validated.startTime,
          endTime,
          facilityId: validated.facilityId,
          capacity: validated.capacity,
          organizationId: session.user.organizationId!,
        })),
      });

      return NextResponse.json(
        {
          message: `Created ${instances.count} instances`,
          count: instances.count,
        },
        { status: 201 }
      );
    } else {
      // Single instance creation
      const validated = createInstanceSchema.parse(body);

      // Calculate end time if not provided
      let endTime = validated.endTime;
      if (!endTime && validated.duration) {
        endTime = calculateEndTime(validated.startTime, validated.duration);
      }

      const instance = await db.programInstance.create({
        data: {
          programId,
          date: new Date(validated.date),
          startTime: validated.startTime,
          endTime: endTime || validated.startTime,
          facilityId: validated.facilityId,
          capacity: validated.capacity,
          notes: validated.notes,
          organizationId: session.user.organizationId!,
        },
        include: {
          facility: {
            select: { id: true, name: true, city: true },
          },
          _count: {
            select: { registrations: true, attendances: true },
          },
        },
      });

      return NextResponse.json(instance, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating instance:", error);
    return NextResponse.json({ error: "Failed to create instance" }, { status: 500 });
  }
}
