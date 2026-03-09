import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";
import { z } from "zod";

const updateStaffSchema = z.object({
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACTOR", "VOLUNTEER"]).optional(),
  title: z.string().optional().nullable(),
  hourlyRate: z.number().optional().nullable(),
  hireDate: z.string().optional().nullable(),
  certifications: z.array(z.object({
    name: z.string(),
    expiresAt: z.string().optional().nullable(),
    verified: z.boolean().optional(),
  })).optional().nullable(),
  phone: z.string().optional().nullable(),
  emergencyContact: z.object({
    name: z.string(),
    phone: z.string(),
    relationship: z.string().optional(),
  }).optional().nullable(),
});

// GET - Get a specific staff profile
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

    const member = await db.organizationMember.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            status: true,
          },
        },
        availability: true,
        _count: {
          select: {
            shifts: true,
            eventAssignments: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error fetching staff profile:", error);
    return NextResponse.json({ error: "Failed to fetch staff profile" }, { status: 500 });
  }
}

// PATCH - Update a staff profile
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
      !session.user.permissions.includes("staff.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify member exists in organization
    const existingMember = await db.organizationMember.findFirst({
      where: { id, organizationId },
    });

    if (!existingMember) {
      return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateStaffSchema.parse(body);

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (validatedData.employmentType !== undefined) updateData.employmentType = validatedData.employmentType;
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.hourlyRate !== undefined) updateData.hourlyRate = validatedData.hourlyRate;
    if (validatedData.hireDate !== undefined) updateData.hireDate = validatedData.hireDate ? parseDateOnly(validatedData.hireDate) : null;
    if (validatedData.certifications !== undefined) updateData.certifications = validatedData.certifications;
    if (validatedData.phone !== undefined) updateData.phone = validatedData.phone;
    if (validatedData.emergencyContact !== undefined) updateData.emergencyContact = validatedData.emergencyContact;

    const member = await db.organizationMember.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            status: true,
          },
        },
        _count: {
          select: {
            shifts: true,
            eventAssignments: true,
          },
        },
      },
    });

    return NextResponse.json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating staff profile:", error);
    return NextResponse.json({ error: "Failed to update staff profile" }, { status: 500 });
  }
}

// DELETE - Delete a staff profile
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
      !session.user.permissions.includes("staff.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify member exists in organization
    const existingMember = await db.organizationMember.findFirst({
      where: { id, organizationId },
    });

    if (!existingMember) {
      return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
    }

    await db.organizationMember.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting staff profile:", error);
    return NextResponse.json({ error: "Failed to delete staff profile" }, { status: 500 });
  }
}
