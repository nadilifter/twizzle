import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";
import { z } from "zod";

const createEquipmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  serialNumber: z.string().optional().nullable(),
  condition: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR", "UNSAFE"]).optional(),
  status: z.enum(["ACTIVE", "RETIRED", "MAINTENANCE"]).optional(),
  trainingZoneId: z.string().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  lastInspectionDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET - List all equipment for a facility
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

    const equipment = await db.equipment.findMany({
      where: { facilityId },
      include: {
        trainingZone: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(equipment);
  } catch (error) {
    console.error("Error fetching equipment:", error);
    return NextResponse.json({ error: "Failed to fetch equipment" }, { status: 500 });
  }
}

// POST - Create new equipment for a facility
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
    const validatedData = createEquipmentSchema.parse(body);

    // Verify training zone belongs to this facility if provided
    if (validatedData.trainingZoneId) {
      const zone = await db.trainingZone.findFirst({
        where: { id: validatedData.trainingZoneId, facilityId },
      });
      if (!zone) {
        return NextResponse.json({ error: "Training zone not found" }, { status: 404 });
      }
    }

    const equipment = await db.equipment.create({
      data: {
        organizationId,
        facilityId,
        name: validatedData.name,
        type: validatedData.type,
        serialNumber: validatedData.serialNumber ?? null,
        condition: validatedData.condition ?? "GOOD",
        status: validatedData.status ?? "ACTIVE",
        trainingZoneId: validatedData.trainingZoneId ?? null,
        purchaseDate: validatedData.purchaseDate ? parseDateOnly(validatedData.purchaseDate) : null,
        lastInspectionDate: validatedData.lastInspectionDate ? parseDateOnly(validatedData.lastInspectionDate) : null,
        notes: validatedData.notes ?? null,
      },
      include: {
        trainingZone: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(equipment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating equipment:", error);
    return NextResponse.json({ error: "Failed to create equipment" }, { status: 500 });
  }
}
