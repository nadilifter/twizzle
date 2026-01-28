import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const addEventStaffSchema = z.object({
  staffProfileId: z.string().min(1, "Staff profile is required"),
  role: z.enum(["LEAD", "ASSISTANT", "VOLUNTEER", "OBSERVER"]).optional(),
  notes: z.string().optional().nullable(),
});

// GET - List all staff assigned to an event
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
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id: eventId } = await params;

    // Verify event exists in organization
    const event = await db.event.findFirst({
      where: { id: eventId, organizationId },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const eventStaff = await db.eventStaff.findMany({
      where: { eventId },
      include: {
        staffProfile: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: [
        { role: "asc" }, // LEAD first
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json(eventStaff);
  } catch (error) {
    console.error("Error fetching event staff:", error);
    return NextResponse.json({ error: "Failed to fetch event staff" }, { status: 500 });
  }
}

// POST - Add staff to an event
export async function POST(
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
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // Check permissions
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("events.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: eventId } = await params;

    // Verify event exists in organization
    const event = await db.event.findFirst({
      where: { id: eventId, organizationId },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = addEventStaffSchema.parse(body);

    // Verify staff profile belongs to organization
    const staffProfile = await db.staffProfile.findFirst({
      where: { id: validatedData.staffProfileId, organizationId },
    });

    if (!staffProfile) {
      return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
    }

    // Check if staff is already assigned to event
    const existingAssignment = await db.eventStaff.findUnique({
      where: {
        eventId_staffProfileId: {
          eventId,
          staffProfileId: validatedData.staffProfileId,
        },
      },
    });

    if (existingAssignment) {
      return NextResponse.json({ error: "Staff member is already assigned to this event" }, { status: 400 });
    }

    const eventStaff = await db.eventStaff.create({
      data: {
        eventId,
        staffProfileId: validatedData.staffProfileId,
        role: validatedData.role || "ASSISTANT",
        notes: validatedData.notes ?? null,
      },
      include: {
        staffProfile: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(eventStaff, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error adding event staff:", error);
    return NextResponse.json({ error: "Failed to add event staff" }, { status: 500 });
  }
}
