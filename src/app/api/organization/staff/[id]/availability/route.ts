import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const availabilityEntrySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  isAvailable: z.boolean().optional(),
});

const updateAvailabilitySchema = z.array(availabilityEntrySchema);

// GET - Get staff availability
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Verify member exists in organization
    const member = await db.organizationMember.findFirst({
      where: { id, organizationId },
    });

    if (!member) {
      return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
    }

    const availability = await db.memberAvailability.findMany({
      where: { memberId: id },
      orderBy: { dayOfWeek: "asc" },
    });

    return NextResponse.json(availability);
  } catch (error) {
    console.error("Error fetching staff availability:", error);
    return NextResponse.json({ error: "Failed to fetch staff availability" }, { status: 500 });
  }
}

// PUT - Update staff availability (replace all entries)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // Check permissions - staff can edit their own availability, or admin can edit any
    const { id } = await params;

    // Verify member exists in organization
    const member = await db.organizationMember.findFirst({
      where: { id, organizationId },
    });

    if (!member) {
      return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
    }

    // Allow staff to edit own availability, or require admin permission
    const isOwnProfile = member.userId === session.user.id;
    if (
      !isOwnProfile &&
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("staff.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateAvailabilitySchema.parse(body);

    // Delete existing availability and create new entries
    await db.$transaction(async (tx) => {
      await tx.memberAvailability.deleteMany({
        where: { memberId: id },
      });

      if (validatedData.length > 0) {
        await tx.memberAvailability.createMany({
          data: validatedData.map((entry) => ({
            memberId: id,
            dayOfWeek: entry.dayOfWeek,
            startTime: entry.startTime,
            endTime: entry.endTime,
            isAvailable: entry.isAvailable ?? true,
          })),
        });
      }
    });

    const availability = await db.memberAvailability.findMany({
      where: { memberId: id },
      orderBy: { dayOfWeek: "asc" },
    });

    return NextResponse.json(availability);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating staff availability:", error);
    return NextResponse.json({ error: "Failed to update staff availability" }, { status: 500 });
  }
}
