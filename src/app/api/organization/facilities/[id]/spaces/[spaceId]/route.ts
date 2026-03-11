import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSpaceSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  capacity: z.number().optional().nullable(),
  status: z.enum(["OPEN", "CLOSED", "MAINTENANCE"]).optional(),
  description: z.string().optional().nullable(),
});

// GET - Get a single space
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; spaceId: string }> }
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

    const { id: facilityId, spaceId } = await params;

    // Verify facility belongs to organization
    const facility = await db.facility.findFirst({
      where: { id: facilityId, organizationId },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const space = await db.space.findFirst({
      where: { id: spaceId, facilityId },
      include: {
        equipment: {
          orderBy: { name: "asc" },
        },
        _count: {
          select: { equipment: true },
        },
      },
    });

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    return NextResponse.json(space);
  } catch (error) {
    console.error("Error fetching space:", error);
    return NextResponse.json({ error: "Failed to fetch space" }, { status: 500 });
  }
}

// PATCH - Update a space
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; spaceId: string }> }
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

    const { id: facilityId, spaceId } = await params;

    // Verify facility belongs to organization
    const facility = await db.facility.findFirst({
      where: { id: facilityId, organizationId },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    // Verify space exists
    const existingSpace = await db.space.findFirst({
      where: { id: spaceId, facilityId },
    });

    if (!existingSpace) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateSpaceSchema.parse(body);

    const space = await db.space.update({
      where: { id: spaceId },
      data: validatedData,
      include: {
        _count: {
          select: { equipment: true },
        },
      },
    });

    return NextResponse.json(space);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating space:", error);
    return NextResponse.json({ error: "Failed to update space" }, { status: 500 });
  }
}

// DELETE - Delete a space
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; spaceId: string }> }
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

    const { id: facilityId, spaceId } = await params;

    // Verify facility belongs to organization
    const facility = await db.facility.findFirst({
      where: { id: facilityId, organizationId },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    // Verify space exists
    const existingSpace = await db.space.findFirst({
      where: { id: spaceId, facilityId },
    });

    if (!existingSpace) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    // Remove space assignment from equipment (set to null)
    await db.equipment.updateMany({
      where: { spaceId },
      data: { spaceId: null },
    });

    await db.space.delete({
      where: { id: spaceId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting space:", error);
    return NextResponse.json({ error: "Failed to delete space" }, { status: 500 });
  }
}
