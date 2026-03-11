import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";
import { z } from "zod";

const createEquipmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  serialNumber: z.string().optional().nullable(),
  condition: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR", "UNSAFE"]).optional(),
  status: z.enum(["ACTIVE", "RETIRED", "MAINTENANCE"]).optional(),
  facilityId: z.string().optional().nullable(),
  spaceId: z.string().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  lastInspectionDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET - List all equipment for the organization (optionally filtered by facility)
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get("facilityId");
    const orgLevelOnly = searchParams.get("orgLevelOnly") === "true";

    const where: { organizationId: string; facilityId?: string | null } = { organizationId };
    
    if (facilityId) {
      where.facilityId = facilityId;
    } else if (orgLevelOnly) {
      where.facilityId = null;
    }

    const equipment = await db.equipment.findMany({
      where,
      include: {
        facility: {
          select: { id: true, name: true },
        },
        space: {
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

// POST - Create new organization-level equipment
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = createEquipmentSchema.parse(body);

    // Verify facility belongs to org if provided
    if (validatedData.facilityId) {
      const facility = await db.facility.findFirst({
        where: { id: validatedData.facilityId, organizationId },
      });
      if (!facility) {
        return NextResponse.json({ error: "Facility not found" }, { status: 404 });
      }
    }

    // Verify space belongs to the facility if both are provided
    if (validatedData.spaceId && validatedData.facilityId) {
      const space = await db.space.findFirst({
        where: { id: validatedData.spaceId, facilityId: validatedData.facilityId },
      });
      if (!space) {
        return NextResponse.json({ error: "Space not found in this facility" }, { status: 404 });
      }
    }

    const equipment = await db.equipment.create({
      data: {
        organizationId,
        name: validatedData.name,
        serialNumber: validatedData.serialNumber ?? null,
        condition: validatedData.condition ?? "GOOD",
        status: validatedData.status ?? "ACTIVE",
        facilityId: validatedData.facilityId ?? null,
        spaceId: validatedData.spaceId ?? null,
        purchaseDate: validatedData.purchaseDate ? parseDateOnly(validatedData.purchaseDate) : null,
        lastInspectionDate: validatedData.lastInspectionDate ? parseDateOnly(validatedData.lastInspectionDate) : null,
        notes: validatedData.notes ?? null,
      },
      include: {
        facility: {
          select: { id: true, name: true },
        },
        space: {
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
