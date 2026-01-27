import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  type: z.enum(["CLASS", "CAMP", "PARTY", "COMPETITION", "MEETING", "OTHER"]).optional(),
  description: z.string().optional().nullable(),
  meetingLink: z.string().optional().nullable(),
  location: z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
    address: z.string().optional(),
    name: z.string().optional(),
  }).optional().nullable(),
  details: z.object({
    whatToBring: z.array(z.string()).optional(),
    whatToExpect: z.string().optional(),
    requirements: z.string().optional(),
  }).optional().nullable(),
  programId: z.string().optional().nullable(),
  coachId: z.string().optional().nullable(),
});

// GET /api/events/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const event = await db.event.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        program: true,
        coach: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        attendances: {
          include: {
            athlete: {
              select: {
                id: true,
                name: true,
                level: true,
                family: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        lineItems: {
          include: {
            invoice: {
              select: {
                id: true,
                reference: true,
                status: true,
                family: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Transform participants from attendances
    const participants = event.attendances.map((a) => a.athlete.name);

    return NextResponse.json({
      ...event,
      participants,
    });
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}

// PATCH /api/events/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permissions = session.user.permissions || [];
    if (
      !permissions.includes("*") &&
      !permissions.includes("events.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateEventSchema.parse(body);

    const existing = await db.event.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const event = await db.event.update({
      where: { id },
      data: {
        ...validatedData,
        date: validatedData.date ? new Date(validatedData.date) : undefined,
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
    console.error("Error updating event:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}

// DELETE /api/events/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permissions = session.user.permissions || [];
    if (
      !permissions.includes("*") &&
      !permissions.includes("events.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.event.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await db.event.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }
}
