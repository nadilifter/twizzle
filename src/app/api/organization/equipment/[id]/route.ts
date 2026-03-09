import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";
import { z } from "zod";

const updateEquipmentSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  type: z.string().min(1, "Type is required").optional(),
  serialNumber: z.string().optional().nullable(),
  condition: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR", "UNSAFE"]).optional(),
  status: z.enum(["ACTIVE", "RETIRED", "MAINTENANCE"]).optional(),
  facilityId: z.string().optional().nullable(),
  trainingZoneId: z.string().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  lastInspectionDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET - Get a single piece of equipment
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

    const equipment = await db.equipment.findFirst({
      where: { id, organizationId },
      include: {
        facility: {
          select: { id: true, name: true },
        },
        trainingZone: {
          select: { id: true, name: true },
        },
      },
    });

    if (!equipment) {
      return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
    }

    return NextResponse.json(equipment);
  } catch (error) {
    console.error("Error fetching equipment:", error);
    return NextResponse.json({ error: "Failed to fetch equipment" }, { status: 500 });
  }
}

// PATCH - Update equipment
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

    const { id } = await params;

    // Verify equipment belongs to organization
    const existingEquipment = await db.equipment.findFirst({
      where: { id, organizationId },
    });

    if (!existingEquipment) {
      return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateEquipmentSchema.parse(body);

    // Verify facility belongs to org if provided
    if (validatedData.facilityId) {
      const facility = await db.facility.findFirst({
        where: { id: validatedData.facilityId, organizationId },
      });
      if (!facility) {
        return NextResponse.json({ error: "Facility not found" }, { status: 404 });
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = { ...validatedData };
    
    if (validatedData.purchaseDate !== undefined) {
      updateData.purchaseDate = validatedData.purchaseDate ? parseDateOnly(validatedData.purchaseDate) : null;
    }
    if (validatedData.lastInspectionDate !== undefined) {
      updateData.lastInspectionDate = validatedData.lastInspectionDate ? parseDateOnly(validatedData.lastInspectionDate) : null;
    }

    // If facility is being cleared, also clear training zone
    if (validatedData.facilityId === null) {
      updateData.trainingZoneId = null;
    }

    const equipment = await db.equipment.update({
      where: { id },
      data: updateData,
      include: {
        facility: {
          select: { id: true, name: true },
        },
        trainingZone: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(equipment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating equipment:", error);
    return NextResponse.json({ error: "Failed to update equipment" }, { status: 500 });
  }
}

// DELETE - Delete equipment
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

    const { id } = await params;

    // Verify equipment belongs to organization
    const existingEquipment = await db.equipment.findFirst({
      where: { id, organizationId },
    });

    if (!existingEquipment) {
      return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
    }

    await db.equipment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting equipment:", error);
    return NextResponse.json({ error: "Failed to delete equipment" }, { status: 500 });
  }
}
