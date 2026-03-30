import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { z } from "zod";

const templateEntrySchema = z.object({
  id: z.string().optional(), // For existing entries
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  shiftType: z.string().min(1, "Shift type is required"),
  memberId: z.string().optional().nullable(),
  facilityId: z.string().optional().nullable(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  entries: z.array(templateEntrySchema).optional(),
});

// GET - Get a specific schedule template
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

    const template = await db.scheduleTemplate.findFirst({
      where: { id, organizationId },
      include: {
        entries: {
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Schedule template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error fetching schedule template:", error);
    return NextResponse.json({ error: "Failed to fetch schedule template" }, { status: 500 });
  }
}

// PATCH - Update a schedule template
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // Check permissions
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("schedules.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify template exists in organization
    const existingTemplate = await db.scheduleTemplate.findFirst({
      where: { id, organizationId },
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: "Schedule template not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateTemplateSchema.parse(body);

    if (validatedData.entries?.length) {
      const scopedDb = getScopedDb(organizationId);
      const facilityIds = [
        ...new Set(validatedData.entries.map((e) => e.facilityId).filter(Boolean)),
      ] as string[];
      const memberIds = [
        ...new Set(validatedData.entries.map((e) => e.memberId).filter(Boolean)),
      ] as string[];

      if (facilityIds.length > 0) {
        const validFacilities = await scopedDb.facility.findMany({
          where: { id: { in: facilityIds } },
          select: { id: true },
        });
        if (validFacilities.length !== facilityIds.length) {
          return NextResponse.json({ error: "One or more facilities not found" }, { status: 404 });
        }
      }
      if (memberIds.length > 0) {
        const validMembers = await scopedDb.organizationMember.findMany({
          where: { id: { in: memberIds } },
          select: { id: true },
        });
        if (validMembers.length !== memberIds.length) {
          return NextResponse.json({ error: "One or more members not found" }, { status: 404 });
        }
      }
    }

    // If entries are provided, replace all entries
    if (validatedData.entries !== undefined) {
      await db.$transaction(async (tx) => {
        const existing = await tx.scheduleTemplate.findFirst({ where: { id, organizationId } });
        if (!existing) {
          throw new Error("Schedule template not found");
        }
        // Delete existing entries
        await tx.scheduleTemplateEntry.deleteMany({
          where: { templateId: id },
        });

        // Update template and create new entries
        await tx.scheduleTemplate.update({
          where: { id },
          data: {
            ...(validatedData.name !== undefined && { name: validatedData.name }),
            ...(validatedData.isActive !== undefined && { isActive: validatedData.isActive }),
            entries: {
              create: validatedData.entries!.map((entry) => ({
                dayOfWeek: entry.dayOfWeek,
                startTime: entry.startTime,
                endTime: entry.endTime,
                shiftType: entry.shiftType,
                memberId: entry.memberId ?? null,
                facilityId: entry.facilityId ?? null,
              })),
            },
          },
        });
      });
    } else {
      // Just update template metadata
      const scopedDb = getScopedDb(organizationId);
      await scopedDb.scheduleTemplate.update({
        where: { id },
        data: {
          ...(validatedData.name !== undefined && { name: validatedData.name }),
          ...(validatedData.isActive !== undefined && { isActive: validatedData.isActive }),
        },
      });
    }

    const template = await db.scheduleTemplate.findUnique({
      where: { id },
      include: {
        entries: {
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        },
        _count: {
          select: {
            entries: true,
          },
        },
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating schedule template:", error);
    return NextResponse.json({ error: "Failed to update schedule template" }, { status: 500 });
  }
}

// DELETE - Delete a schedule template
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

    // Check permissions
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("schedules.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify template exists in organization
    const existingTemplate = await db.scheduleTemplate.findFirst({
      where: { id, organizationId },
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: "Schedule template not found" }, { status: 404 });
    }

    const scopedDb = getScopedDb(organizationId);
    await scopedDb.scheduleTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting schedule template:", error);
    return NextResponse.json({ error: "Failed to delete schedule template" }, { status: 500 });
  }
}
