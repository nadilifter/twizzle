import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const availabilitySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
});

const upsertAvailabilitySchema = z.object({
  slots: z.array(availabilitySlotSchema),
});

type RouteParams = { params: Promise<{ id: string; spaceId: string }> };

async function verifyOwnership(organizationId: string, facilityId: string, spaceId: string) {
  const facility = await db.facility.findFirst({
    where: { id: facilityId, organizationId },
  });
  if (!facility) return null;

  const space = await db.space.findFirst({
    where: { id: spaceId, facilityId },
  });
  return space;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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
    const space = await verifyOwnership(organizationId, facilityId, spaceId);
    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    const availability = await db.spaceAvailability.findMany({
      where: { spaceId },
      orderBy: { dayOfWeek: "asc" },
    });

    return NextResponse.json(availability);
  } catch (error) {
    console.error("Error fetching space availability:", error);
    return NextResponse.json({ error: "Failed to fetch space availability" }, { status: 500 });
  }
}

/**
 * Upsert all availability slots for a space. Replaces existing slots
 * with the provided set (delete-and-recreate).
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const space = await verifyOwnership(organizationId, facilityId, spaceId);
    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    const body = await request.json();
    const { slots } = upsertAvailabilitySchema.parse(body);

    // Validate that open < close for each slot
    for (const slot of slots) {
      if (slot.openTime >= slot.closeTime) {
        return NextResponse.json(
          { error: `Open time must be before close time for day ${slot.dayOfWeek}` },
          { status: 400 }
        );
      }
    }

    // Check for duplicate days
    const days = slots.map((s) => s.dayOfWeek);
    if (new Set(days).size !== days.length) {
      return NextResponse.json(
        { error: "Duplicate day of week entries" },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      await tx.spaceAvailability.deleteMany({
        where: { spaceId },
      });

      if (slots.length > 0) {
        await tx.spaceAvailability.createMany({
          data: slots.map((slot) => ({
            spaceId,
            dayOfWeek: slot.dayOfWeek,
            openTime: slot.openTime,
            closeTime: slot.closeTime,
          })),
        });
      }

      return tx.spaceAvailability.findMany({
        where: { spaceId },
        orderBy: { dayOfWeek: "asc" },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating space availability:", error);
    return NextResponse.json({ error: "Failed to update space availability" }, { status: 500 });
  }
}
