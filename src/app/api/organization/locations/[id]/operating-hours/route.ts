import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const operatingHoursSlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
});

const upsertOperatingHoursSchema = z.object({
  slots: z.array(operatingHoursSlotSchema),
});

type RouteParams = { params: Promise<{ id: string }> };

async function verifyFacilityOwnership(organizationId: string, facilityId: string) {
  return db.facility.findFirst({
    where: { id: facilityId, organizationId },
  });
}

function slotsOverlap(
  a: { openTime: string; closeTime: string },
  b: { openTime: string; closeTime: string }
) {
  return a.openTime < b.closeTime && b.openTime < a.closeTime;
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

    const { id: facilityId } = await params;
    const facility = await verifyFacilityOwnership(organizationId, facilityId);
    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const hours = await db.facilityOperatingHours.findMany({
      where: { facilityId },
      orderBy: [{ dayOfWeek: "asc" }, { openTime: "asc" }],
    });

    return NextResponse.json(hours);
  } catch (error) {
    console.error("Error fetching facility operating hours:", error);
    return NextResponse.json({ error: "Failed to fetch operating hours" }, { status: 500 });
  }
}

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

    const { id: facilityId } = await params;
    const facility = await verifyFacilityOwnership(organizationId, facilityId);
    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const body = await request.json();
    const { slots } = upsertOperatingHoursSchema.parse(body);

    for (const slot of slots) {
      if (slot.openTime >= slot.closeTime) {
        return NextResponse.json(
          { error: `Open time must be before close time for day ${slot.dayOfWeek}` },
          { status: 400 }
        );
      }
    }

    // Check for overlapping time blocks on the same day
    const byDay = new Map<number, Array<{ openTime: string; closeTime: string }>>();
    for (const slot of slots) {
      const existing = byDay.get(slot.dayOfWeek) ?? [];
      for (const prev of existing) {
        if (slotsOverlap(prev, slot)) {
          return NextResponse.json(
            { error: `Overlapping time blocks on day ${slot.dayOfWeek}` },
            { status: 400 }
          );
        }
      }
      existing.push(slot);
      byDay.set(slot.dayOfWeek, existing);
    }

    const result = await db.$transaction(async (tx) => {
      await tx.facilityOperatingHours.deleteMany({
        where: { facilityId },
      });

      if (slots.length > 0) {
        await tx.facilityOperatingHours.createMany({
          data: slots.map((slot) => ({
            facilityId,
            dayOfWeek: slot.dayOfWeek,
            openTime: slot.openTime,
            closeTime: slot.closeTime,
          })),
        });
      }

      return tx.facilityOperatingHours.findMany({
        where: { facilityId },
        orderBy: [{ dayOfWeek: "asc" }, { openTime: "asc" }],
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating facility operating hours:", error);
    return NextResponse.json({ error: "Failed to update operating hours" }, { status: 500 });
  }
}
