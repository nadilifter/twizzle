import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createSpaceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  capacity: z.number().optional().nullable(),
  status: z.enum(["OPEN", "CLOSED", "MAINTENANCE"]).optional(),
  description: z.string().optional().nullable(),
});

// GET - List all spaces for a facility
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

    const spaces = await db.space.findMany({
      where: { facilityId },
      include: {
        _count: {
          select: { equipment: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(spaces);
  } catch (error) {
    console.error("Error fetching spaces:", error);
    return NextResponse.json({ error: "Failed to fetch spaces" }, { status: 500 });
  }
}

// POST - Create a new space
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
    const validatedData = createSpaceSchema.parse(body);

    const space = await db.space.create({
      data: {
        facilityId,
        name: validatedData.name,
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

    return NextResponse.json(space, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating space:", error);
    return NextResponse.json({ error: "Failed to create space" }, { status: 500 });
  }
}
