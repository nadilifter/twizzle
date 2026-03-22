import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";

const updateFacilitySchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  street: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  stateProvince: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  phone: z.string().refine((val) => !val || isValidPhoneNumber(val), "Please enter a valid phone number").optional().nullable(),
  email: z.string().email().optional().nullable(),
  squareFootage: z.number().optional().nullable(),
  maxCapacity: z.number().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]).optional(),
  isDefault: z.boolean().optional(),
});

// GET - Get a single facility by ID
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

    const facility = await db.facility.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        spaces: {
          orderBy: { name: "asc" },
        },
        equipment: {
          orderBy: { name: "asc" },
        },
        assignments: {
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
        },
        _count: {
          select: {
            spaces: true,
            equipment: true,
            assignments: true,
            events: true,
          },
        },
      },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    return NextResponse.json(facility);
  } catch (error) {
    console.error("Error fetching facility:", error);
    return NextResponse.json({ error: "Failed to fetch facility" }, { status: 500 });
  }
}

// PATCH - Update a facility
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
    const body = await request.json();
    const validatedData = updateFacilitySchema.parse(body);

    // Verify facility belongs to organization
    const existingFacility = await db.facility.findFirst({
      where: { id, organizationId },
    });

    if (!existingFacility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    // If this is set as default, unset other defaults
    if (validatedData.isDefault) {
      await db.facility.updateMany({
        where: { organizationId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const scopedDb = getScopedDb(organizationId);
    const facility = await scopedDb.facility.update({
      where: { id },
      data: validatedData,
      include: {
        _count: {
          select: {
            spaces: true,
            equipment: true,
            assignments: true,
            events: true,
          },
        },
      },
    });

    return NextResponse.json(facility);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating facility:", error);
    return NextResponse.json({ error: "Failed to update facility" }, { status: 500 });
  }
}

// DELETE - Delete a facility
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

    // Verify facility belongs to organization
    const existingFacility = await db.facility.findFirst({
      where: { id, organizationId },
    });

    if (!existingFacility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    // Prevent deleting the default facility if it's the only one
    if (existingFacility.isDefault) {
      const facilityCount = await db.facility.count({
        where: { organizationId },
      });

      if (facilityCount === 1) {
        return NextResponse.json(
          { error: "Cannot delete the only facility. Create another facility first." },
          { status: 400 }
        );
      }
    }

    const scopedDb = getScopedDb(organizationId);
    await scopedDb.facility.delete({
      where: { id },
    });

    // If deleted facility was default, set another as default
    if (existingFacility.isDefault) {
      const newDefault = await db.facility.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "asc" },
      });

      if (newDefault) {
        await scopedDb.facility.update({
          where: { id: newDefault.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting facility:", error);
    return NextResponse.json({ error: "Failed to delete facility" }, { status: 500 });
  }
}
