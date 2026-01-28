import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateAssignmentSchema = z.object({
  isPrimary: z.boolean().optional(),
});

// PATCH - Update a facility assignment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
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

    const { id: facilityId, userId } = await params;

    // Verify facility belongs to organization
    const facility = await db.facility.findFirst({
      where: { id: facilityId, organizationId },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    // Verify assignment exists
    const existingAssignment = await db.facilityAssignment.findFirst({
      where: { facilityId, userId },
    });

    if (!existingAssignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateAssignmentSchema.parse(body);

    // If this is set as primary, unset other primaries for this user
    if (validatedData.isPrimary) {
      await db.facilityAssignment.updateMany({
        where: { userId, isPrimary: true, id: { not: existingAssignment.id } },
        data: { isPrimary: false },
      });
    }

    const assignment = await db.facilityAssignment.update({
      where: { id: existingAssignment.id },
      data: validatedData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json(assignment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating facility assignment:", error);
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
  }
}

// DELETE - Remove a user from a facility
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
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

    const { id: facilityId, userId } = await params;

    // Verify facility belongs to organization
    const facility = await db.facility.findFirst({
      where: { id: facilityId, organizationId },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    // Verify assignment exists
    const existingAssignment = await db.facilityAssignment.findFirst({
      where: { facilityId, userId },
    });

    if (!existingAssignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    await db.facilityAssignment.delete({
      where: { id: existingAssignment.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting facility assignment:", error);
    return NextResponse.json({ error: "Failed to delete assignment" }, { status: 500 });
  }
}
