import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  type: z.enum(["CLASS", "CAMP", "PARTY", "COMPETITION", "MEETING", "OTHER"]).default("CLASS"),
  description: z.string().optional(),
  meetingLink: z.string().optional(),
  location: z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
    address: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
  details: z.object({
    whatToBring: z.array(z.string()).optional(),
    whatToExpect: z.string().optional(),
    requirements: z.string().optional(),
  }).optional(),
  programId: z.string().optional().nullable(),
  coachId: z.string().optional().nullable(),
});

// GET /api/events
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type");
    const programId = searchParams.get("programId");
    const coachId = searchParams.get("coachId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = {
      organizationId: session.user.organizationId,
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(type && { type: type as "CLASS" | "CAMP" | "PARTY" | "COMPETITION" | "MEETING" | "OTHER" }),
      ...(programId && { programId }),
      ...(coachId && { coachId }),
      ...(startDate && endDate && {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
    };

    const [events, total] = await Promise.all([
      db.event.findMany({
        where,
        include: {
          program: {
            select: {
              id: true,
              name: true,
              level: true,
            },
          },
          coach: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              attendances: true,
            },
          },
        },
        orderBy: { date: "asc" },
        take: limit,
        skip: offset,
      }),
      db.event.count({ where }),
    ]);

    // Transform for frontend compatibility
    const transformedEvents = events.map((event) => ({
      ...event,
      type: event.type,
      participants: [], // Will be populated from attendances
      attendanceCount: event._count.attendances,
    }));

    return NextResponse.json({
      data: transformedEvents,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

// POST /api/events
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("events.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createEventSchema.parse(body);

    // Verify program if provided
    if (validatedData.programId) {
      const program = await db.program.findFirst({
        where: {
          id: validatedData.programId,
          organizationId: session.user.organizationId,
        },
      });
      if (!program) {
        return NextResponse.json({ error: "Program not found" }, { status: 404 });
      }
    }

    // Verify coach if provided
    if (validatedData.coachId) {
      const coach = await db.user.findFirst({
        where: {
          id: validatedData.coachId,
          organizationId: session.user.organizationId,
        },
      });
      if (!coach) {
        return NextResponse.json({ error: "Coach not found" }, { status: 404 });
      }
    }

    const event = await db.event.create({
      data: {
        title: validatedData.title,
        date: new Date(validatedData.date),
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        type: validatedData.type,
        description: validatedData.description,
        meetingLink: validatedData.meetingLink,
        location: validatedData.location,
        details: validatedData.details,
        programId: validatedData.programId,
        coachId: validatedData.coachId,
        organizationId: session.user.organizationId,
      },
      include: {
        program: true,
        coach: true,
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating event:", error);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
