import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateShiftSchema = z.object({
  staffProfileId: z.string().optional(),
  facilityId: z.string().optional().nullable(),
  date: z.string().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time must be in HH:MM format").optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time must be in HH:MM format").optional(),
  shiftType: z.string().optional(),
  notes: z.string().optional().nullable(),
  status: z.enum(["SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
});

// GET - Get a specific shift
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

    const { id } = await params;

    const shift = await db.shift.findFirst({
      where: { id, organizationId },
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
        facility: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    return NextResponse.json(shift);
  } catch (error) {
    console.error("Error fetching shift:", error);
    return NextResponse.json({ error: "Failed to fetch shift" }, { status: 500 });
  }
}

// PATCH - Update a shift
export async function PATCH(
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
      !session.user.permissions.includes("schedules.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify shift exists in organization
    const existingShift = await db.shift.findFirst({
      where: { id, organizationId },
    });

    if (!existingShift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateShiftSchema.parse(body);

    // Verify staff profile if changing
    if (validatedData.staffProfileId) {
      const staffProfile = await db.staffProfile.findFirst({
        where: { id: validatedData.staffProfileId, organizationId },
      });
      if (!staffProfile) {
        return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
      }
    }

    // Verify facility if changing
    if (validatedData.facilityId) {
      const facility = await db.facility.findFirst({
        where: { id: validatedData.facilityId, organizationId },
      });
      if (!facility) {
        return NextResponse.json({ error: "Facility not found" }, { status: 404 });
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (validatedData.staffProfileId !== undefined) updateData.staffProfileId = validatedData.staffProfileId;
    if (validatedData.facilityId !== undefined) updateData.facilityId = validatedData.facilityId;
    if (validatedData.date !== undefined) updateData.date = new Date(validatedData.date);
    if (validatedData.startTime !== undefined) updateData.startTime = validatedData.startTime;
    if (validatedData.endTime !== undefined) updateData.endTime = validatedData.endTime;
    if (validatedData.shiftType !== undefined) updateData.shiftType = validatedData.shiftType;
    if (validatedData.notes !== undefined) updateData.notes = validatedData.notes;
    if (validatedData.status !== undefined) updateData.status = validatedData.status;

    const shift = await db.shift.update({
      where: { id },
      data: updateData,
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
        facility: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(shift);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating shift:", error);
    return NextResponse.json({ error: "Failed to update shift" }, { status: 500 });
  }
}

// DELETE - Delete a shift
export async function DELETE(
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
      !session.user.permissions.includes("schedules.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify shift exists in organization
    const existingShift = await db.shift.findFirst({
      where: { id, organizationId },
    });

    if (!existingShift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    await db.shift.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shift:", error);
    return NextResponse.json({ error: "Failed to delete shift" }, { status: 500 });
  }
}
