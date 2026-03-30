import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { calculateEndTime } from "@/lib/program-instance-utils";
import { parseDateOnly } from "@/lib/date-utils";
import { z } from "zod";

const updateHolidaySchema = z.object({
  isEnabled: z.boolean(),
  cancelInstanceIds: z.array(z.string()).optional(),
  createInstancesForProgramIds: z.array(z.string()).optional(),
});

// PATCH /api/holidays/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const organizationId = session.user.organizationId!;
    const scopedDb = getScopedDb(organizationId);

    const existing = await scopedDb.organizationHoliday.findFirst({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Holiday not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateHolidaySchema.parse(body);

    const holiday = await db.$transaction(async (tx) => {
      const verified = await tx.organizationHoliday.findFirst({
        where: { id, organizationId },
        select: { id: true },
      });
      if (!verified) throw new Error("Holiday not found in transaction");

      const updated = await tx.organizationHoliday.update({
        where: { id },
        data: { isEnabled: validatedData.isEnabled },
      });

      // Cancel specified program instances when enabling a holiday
      if (validatedData.cancelInstanceIds?.length) {
        await tx.programInstance.updateMany({
          where: {
            id: { in: validatedData.cancelInstanceIds },
            organizationId,
            status: "SCHEDULED",
          },
          data: { status: "CANCELLED" },
        });
      }

      // Re-create program instances when disabling a holiday
      if (validatedData.createInstancesForProgramIds?.length) {
        const programs = await tx.program.findMany({
          where: {
            id: { in: validatedData.createInstancesForProgramIds },
            organizationId,
          },
          include: {
            spaces: { select: { spaceId: true } },
          },
        });

        for (const program of programs) {
          if (!program.startTime || !program.duration) continue;

          const endTime = calculateEndTime(program.startTime, program.duration);

          const instance = await tx.programInstance.create({
            data: {
              programId: program.id,
              date: existing.date,
              startTime: program.startTime,
              endTime,
              facilityId: program.facilityId,
              capacity: program.capacity,
              organizationId,
            },
          });

          if (program.spaces.length > 0) {
            await tx.programInstanceSpace.createMany({
              data: program.spaces.map((ps) => ({
                programInstanceId: instance.id,
                spaceId: ps.spaceId,
              })),
            });
          }
        }
      }

      return updated;
    });

    return NextResponse.json(holiday);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating holiday:", error);
    return NextResponse.json({ error: "Failed to update holiday" }, { status: 500 });
  }
}

// DELETE /api/holidays/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const organizationId = session.user.organizationId!;
    const scopedDb = getScopedDb(organizationId);

    const existing = await scopedDb.organizationHoliday.findFirst({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Holiday not found" }, { status: 404 });
    }

    if (existing.type === "NATIONAL") {
      return NextResponse.json(
        { error: "National holidays cannot be deleted. Disable them instead." },
        { status: 400 }
      );
    }

    await scopedDb.organizationHoliday.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting holiday:", error);
    return NextResponse.json({ error: "Failed to delete holiday" }, { status: 500 });
  }
}
