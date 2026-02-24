import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateInstanceSchema = z.object({
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  facilityId: z.string().optional().nullable(),
  capacity: z.number().int().min(1).optional().nullable(),
  status: z.enum(["SCHEDULED", "CANCELLED", "COMPLETED"]).optional(),
  notes: z.string().optional().nullable(),
});

// GET /api/programs/[id]/instances/[instanceId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: programId, instanceId } = await params;

    const instance = await db.programInstance.findFirst({
      where: {
        id: instanceId,
        programId,
        organizationId: session.user.organizationId,
      },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            recurrenceType: true,
            registrationType: true,
          },
        },
        facility: {
          select: { id: true, name: true, address: true, city: true, stateProvince: true },
        },
        registrations: {
          include: {
            athlete: {
              select: {
                id: true,
                name: true,
                avatar: true,
                level: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        attendances: {
          include: {
            athlete: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: { registrations: true, attendances: true },
        },
      },
    });

    if (!instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    return NextResponse.json(instance);
  } catch (error) {
    console.error("Error fetching instance:", error);
    return NextResponse.json(
      { error: "Failed to fetch instance" },
      { status: 500 }
    );
  }
}

// PATCH /api/programs/[id]/instances/[instanceId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string }> }
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

    const { id: programId, instanceId } = await params;
    const body = await request.json();
    const validated = updateInstanceSchema.parse(body);

    const existing = await db.programInstance.findFirst({
      where: {
        id: instanceId,
        programId,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (validated.date !== undefined) updateData.date = new Date(validated.date);
    if (validated.startTime !== undefined) updateData.startTime = validated.startTime;
    if (validated.endTime !== undefined) updateData.endTime = validated.endTime;
    if (validated.facilityId !== undefined) updateData.facilityId = validated.facilityId;
    if (validated.capacity !== undefined) updateData.capacity = validated.capacity;
    if (validated.status !== undefined) updateData.status = validated.status;
    if (validated.notes !== undefined) updateData.notes = validated.notes;

    const instance = await db.programInstance.update({
      where: { id: instanceId },
      data: updateData,
      include: {
        program: {
          select: { id: true, name: true },
        },
        facility: {
          select: { id: true, name: true, city: true },
        },
        _count: {
          select: { registrations: true, attendances: true },
        },
      },
    });

    return NextResponse.json(instance);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating instance:", error);
    return NextResponse.json(
      { error: "Failed to update instance" },
      { status: 500 }
    );
  }
}

// DELETE /api/programs/[id]/instances/[instanceId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: programId, instanceId } = await params;

    const existing = await db.programInstance.findFirst({
      where: {
        id: instanceId,
        programId,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    // Check if there are registrations
    if (existing._count.registrations > 0) {
      return NextResponse.json(
        { error: "Cannot delete instance with registrations. Cancel it instead." },
        { status: 400 }
      );
    }

    await db.programInstance.delete({ where: { id: instanceId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting instance:", error);
    return NextResponse.json(
      { error: "Failed to delete instance" },
      { status: 500 }
    );
  }
}
