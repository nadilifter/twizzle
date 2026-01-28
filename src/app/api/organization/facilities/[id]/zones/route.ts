import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createZoneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  capacity: z.number().optional().nullable(),
  status: z.enum(["OPEN", "CLOSED", "MAINTENANCE"]).optional(),
  description: z.string().optional().nullable(),
});

// GET - List all training zones for a facility
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

    const zones = await db.trainingZone.findMany({
      where: { facilityId },
      include: {
        _count: {
          select: { equipment: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(zones);
  } catch (error) {
    console.error("Error fetching training zones:", error);
    return NextResponse.json({ error: "Failed to fetch training zones" }, { status: 500 });
  }
}

// POST - Create a new training zone
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
    const validatedData = createZoneSchema.parse(body);

    const zone = await db.trainingZone.create({
      data: {
        facilityId,
        name: validatedData.name,
        type: validatedData.type,
        capacity: validatedData.capacity ?? null,
        status: validatedData.status ?? "OPEN",
        description: validatedData.description ?? null,
      },
      include: {
        _count: {
          select: { equipment: true },
        },
      },
    });

    return NextResponse.json(zone, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating training zone:", error);
    return NextResponse.json({ error: "Failed to create training zone" }, { status: 500 });
  }
}
