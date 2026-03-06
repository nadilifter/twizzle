import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateProgramStaffSchema = z.object({
  role: z.enum(["LEAD_COACH", "ASSISTANT_COACH", "SUBSTITUTE", "VOLUNTEER"]).optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

// PATCH - Update program staff assignment
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
      !session.user.permissions.includes("training.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: programId, staffId } = await params;

    // Verify program exists in organization
    const program = await db.program.findFirst({
      where: { id: programId, organizationId },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    // Verify program staff assignment exists
    const existingAssignment = await db.programStaff.findFirst({
      where: { id: staffId, programId },
    });

    if (!existingAssignment) {
      return NextResponse.json({ error: "Staff assignment not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateProgramStaffSchema.parse(body);

    // If setting as primary, remove primary from others
    if (validatedData.isPrimary) {
      await db.programStaff.updateMany({
        where: { programId, isPrimary: true, id: { not: staffId } },
        data: { isPrimary: false },
      });
    }

    const programStaff = await db.programStaff.update({
      where: { id: staffId },
      data: {
        ...(validatedData.role !== undefined && { role: validatedData.role }),
        ...(validatedData.isPrimary !== undefined && { isPrimary: validatedData.isPrimary }),
        ...(validatedData.notes !== undefined && { notes: validatedData.notes }),
      },
      include: {
        member: {
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

    return NextResponse.json(programStaff);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating program staff:", error);
    return NextResponse.json({ error: "Failed to update program staff" }, { status: 500 });
  }
}

// DELETE - Remove staff from a program
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
      !session.user.permissions.includes("training.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: programId, staffId } = await params;

    // Verify program exists in organization
    const program = await db.program.findFirst({
      where: { id: programId, organizationId },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    // Verify program staff assignment exists
    const existingAssignment = await db.programStaff.findFirst({
      where: { id: staffId, programId },
    });

    if (!existingAssignment) {
      return NextResponse.json({ error: "Staff assignment not found" }, { status: 404 });
    }

    await db.programStaff.delete({
      where: { id: staffId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing program staff:", error);
    return NextResponse.json({ error: "Failed to remove program staff" }, { status: 500 });
  }
}
