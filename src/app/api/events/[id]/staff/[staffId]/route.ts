import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateEventStaffSchema = z.object({
  role: z.enum(["LEAD", "ASSISTANT", "VOLUNTEER", "OBSERVER"]).optional(),
  notes: z.string().optional().nullable(),
});

// PATCH - Update event staff assignment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> }
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

    const { id: eventId, staffId } = await params;

    // Verify event exists in organization
    const event = await db.event.findFirst({
      where: { id: eventId, organizationId },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Verify event staff assignment exists
    const existingAssignment = await db.eventStaff.findFirst({
      where: { id: staffId, eventId },
    });

    if (!existingAssignment) {
      return NextResponse.json({ error: "Staff assignment not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateEventStaffSchema.parse(body);

    const eventStaff = await db.eventStaff.update({
      where: { id: staffId },
      data: {
        ...(validatedData.role !== undefined && { role: validatedData.role }),
        ...(validatedData.notes !== undefined && { notes: validatedData.notes }),
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

    return NextResponse.json(eventStaff);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating event staff:", error);
    return NextResponse.json({ error: "Failed to update event staff" }, { status: 500 });
  }
}

// DELETE - Remove staff from an event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> }
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

    const { id: eventId, staffId } = await params;

    // Verify event exists in organization
    const event = await db.event.findFirst({
      where: { id: eventId, organizationId },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Verify event staff assignment exists
    const existingAssignment = await db.eventStaff.findFirst({
      where: { id: staffId, eventId },
    });

    if (!existingAssignment) {
      return NextResponse.json({ error: "Staff assignment not found" }, { status: 404 });
    }

    await db.eventStaff.delete({
      where: { id: staffId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing event staff:", error);
    return NextResponse.json({ error: "Failed to remove event staff" }, { status: 500 });
  }
}
