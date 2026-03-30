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

    const member = await db.organizationMember.findFirst({
      where: { id, organizationId },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const availability = await db.memberAvailability.findMany({
      where: { memberId: id },
      orderBy: { dayOfWeek: "asc" },
    });

    return NextResponse.json(availability);
  } catch (error) {
    console.error("Error fetching member availability:", error);
    return NextResponse.json({ error: "Failed to fetch availability" }, { status: 500 });
  }
}

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

    const { id } = await params;

    const member = await db.organizationMember.findFirst({
      where: { id, organizationId },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const isOwnProfile = member.userId === session.user.id;
    if (
      !isOwnProfile &&
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("users.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateAvailabilitySchema.parse(body);

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
    console.error("Error updating member availability:", error);
    return NextResponse.json({ error: "Failed to update availability" }, { status: 500 });
  }
}
