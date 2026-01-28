import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateZoneSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  type: z.string().min(1, "Type is required").optional(),
  capacity: z.number().optional().nullable(),
  status: z.enum(["OPEN", "CLOSED", "MAINTENANCE"]).optional(),
  description: z.string().optional().nullable(),
});

// GET - Get a single training zone
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; zoneId: string }> }
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

    const { id: facilityId, zoneId } = await params;

    // Verify facility belongs to organization
    const facility = await db.facility.findFirst({
      where: { id: facilityId, organizationId },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const zone = await db.trainingZone.findFirst({
      where: { id: zoneId, facilityId },
      include: {
        equipment: {
          orderBy: { name: "asc" },
        },
        _count: {
          select: { equipment: true },
        },
      },
    });

    if (!zone) {
      return NextResponse.json({ error: "Training zone not found" }, { status: 404 });
    }

    return NextResponse.json(zone);
  } catch (error) {
    console.error("Error fetching training zone:", error);
    return NextResponse.json({ error: "Failed to fetch training zone" }, { status: 500 });
  }
}

// PATCH - Update a training zone
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; zoneId: string }> }
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

    const { id: facilityId, zoneId } = await params;

    // Verify facility belongs to organization
    const facility = await db.facility.findFirst({
      where: { id: facilityId, organizationId },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    // Verify zone exists
    const existingZone = await db.trainingZone.findFirst({
      where: { id: zoneId, facilityId },
    });

    if (!existingZone) {
      return NextResponse.json({ error: "Training zone not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateZoneSchema.parse(body);

    const zone = await db.trainingZone.update({
      where: { id: zoneId },
      data: validatedData,
      include: {
        _count: {
          select: { equipment: true },
        },
      },
    });

    return NextResponse.json(zone);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating training zone:", error);
    return NextResponse.json({ error: "Failed to update training zone" }, { status: 500 });
  }
}

// DELETE - Delete a training zone
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; zoneId: string }> }
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

    const { id: facilityId, zoneId } = await params;

    // Verify facility belongs to organization
    const facility = await db.facility.findFirst({
      where: { id: facilityId, organizationId },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    // Verify zone exists
    const existingZone = await db.trainingZone.findFirst({
      where: { id: zoneId, facilityId },
    });

    if (!existingZone) {
      return NextResponse.json({ error: "Training zone not found" }, { status: 404 });
    }

    // Remove zone assignment from equipment (set to null)
    await db.equipment.updateMany({
      where: { trainingZoneId: zoneId },
      data: { trainingZoneId: null },
    });

    await db.trainingZone.delete({
      where: { id: zoneId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting training zone:", error);
    return NextResponse.json({ error: "Failed to delete training zone" }, { status: 500 });
  }
}
