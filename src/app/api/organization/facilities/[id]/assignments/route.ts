import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createAssignmentSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  isPrimary: z.boolean().optional(),
});

// GET - List all staff assignments for a facility
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

    const { id: facilityId } = await params;

    // Verify facility belongs to organization
    const facility = await db.facility.findFirst({
      where: { id: facilityId, organizationId },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const assignments = await db.facilityAssignment.findMany({
      where: { facilityId },
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
      orderBy: [
        { isPrimary: "desc" },
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Error fetching facility assignments:", error);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}

// POST - Assign a user to a facility
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

    const { id: facilityId } = await params;

    // Verify facility belongs to organization
    const facility = await db.facility.findFirst({
      where: { id: facilityId, organizationId },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = createAssignmentSchema.parse(body);

    // Verify user is a member of this organization
    const orgMember = await db.organizationMember.findFirst({
      where: {
        organizationId,
        userId: validatedData.userId,
        status: "ACTIVE",
      },
    });

    if (!orgMember) {
      return NextResponse.json({ error: "User is not a member of this organization" }, { status: 400 });
    }

    // Check if assignment already exists
    const existingAssignment = await db.facilityAssignment.findFirst({
      where: {
        facilityId,
        userId: validatedData.userId,
      },
    });

    if (existingAssignment) {
      return NextResponse.json({ error: "User is already assigned to this facility" }, { status: 400 });
    }

    // If this is set as primary, unset other primaries for this user
    if (validatedData.isPrimary) {
      await db.facilityAssignment.updateMany({
        where: { userId: validatedData.userId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const assignment = await db.facilityAssignment.create({
      data: {
        facilityId,
        userId: validatedData.userId,
        isPrimary: validatedData.isPrimary ?? false,
      },
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

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating facility assignment:", error);
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
  }
}
