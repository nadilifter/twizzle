import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";
import { z } from "zod";

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  type: z.enum(["CLASS", "CLINIC", "PARTY", "TRYOUT", "MEETING", "OTHER"]).optional(),
  description: z.string().optional().nullable(),
  meetingLink: z.string().optional().nullable(),
  location: z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
    address: z.string().optional(),
    name: z.string().optional(),
  }).optional().nullable(),
  details: z.object({
    whatToBring: z.array(z.string()).optional(),
    whatToExpect: z.string().optional(),
    requirements: z.string().optional(),
  }).optional().nullable(),
  programId: z.string().optional().nullable(),
  coachId: z.string().optional().nullable(),
  hasGenderRestriction: z.boolean().optional(),
  allowedGenders: z.array(z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"])).optional(),
  hasFileRequirement: z.boolean().optional(),
  fileRequirementConfig: z.any().optional().nullable(),
  glCodeId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
});

// GET /api/events/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const event = await db.event.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        program: {
          select: {
            id: true,
            name: true,
          },
        },
        coach: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        facility: {
          select: {
            id: true,
            name: true,
            street: true,
            city: true,
            stateProvince: true,
          },
        },
        staffAssignments: {
          include: {
            member: {
              include: {
                user: {
                  select: {
                    name: true,
                    avatar: true,
                  },
                },
              },
            },
          },
          orderBy: {
            role: "asc",
          },
        },
        requiredMemberships: {
          select: {
            id: true,
            name: true,
            group: {
              select: {
                name: true,
              },
            },
          },
        },
        attendances: {
          include: {
            athlete: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        _count: {
          select: {
            attendances: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...event,
      attendanceCount: event._count.attendances,
    });
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}

// PATCH /api/events/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permissions = session.user.permissions || [];
    if (
      !permissions.includes("*") &&
      !permissions.includes("events.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateEventSchema.parse(body);

    const existing = await db.event.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const scopedDb = getScopedDb(session.user.organizationId);

    if (validatedData.programId) {
      const program = await scopedDb.program.findUnique({ where: { id: validatedData.programId } });
      if (!program) {
        return NextResponse.json({ error: "Program not found" }, { status: 404 });
      }
    }

    if (validatedData.coachId) {
      const coach = await db.organizationMember.findFirst({
        where: { userId: validatedData.coachId, organizationId: session.user.organizationId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!coach) {
        return NextResponse.json({ error: "Coach not found" }, { status: 404 });
      }
    }

    if (validatedData.glCodeId) {
      const glCode = await scopedDb.gLCode.findUnique({ where: { id: validatedData.glCodeId } });
      if (!glCode) {
        return NextResponse.json({ error: "GL code not found" }, { status: 404 });
      }
    }
    if (validatedData.categoryId) {
      const cat = await scopedDb.category.findUnique({ where: { id: validatedData.categoryId }, select: { id: true } });
      if (!cat) return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const event = await scopedDb.event.update({
      where: { id },
      data: {
        title: validatedData.title,
        color: validatedData.color,
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        type: validatedData.type,
        description: validatedData.description,
        meetingLink: validatedData.meetingLink,
        location: validatedData.location ?? undefined,
        details: validatedData.details ?? undefined,
        programId: validatedData.programId,
        coachId: validatedData.coachId,
        date: validatedData.date ? parseDateOnly(validatedData.date) ?? undefined : undefined,
        ...(validatedData.hasGenderRestriction !== undefined && {
          hasGenderRestriction: validatedData.hasGenderRestriction,
          allowedGenders: validatedData.hasGenderRestriction ? (validatedData.allowedGenders ?? []) : [],
        }),
        ...(validatedData.hasFileRequirement !== undefined && { hasFileRequirement: validatedData.hasFileRequirement }),
        ...(validatedData.fileRequirementConfig !== undefined && { fileRequirementConfig: validatedData.fileRequirementConfig }),
        ...(validatedData.categoryId !== undefined && { categoryId: validatedData.categoryId }),
      },
      include: {
        program: true,
        coach: true,
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating event:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}

// DELETE /api/events/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permissions = session.user.permissions || [];
    if (
      !permissions.includes("*") &&
      !permissions.includes("events.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.event.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const linkedLineItems = await db.lineItem.count({
      where: { eventId: id },
    });

    if (linkedLineItems > 0) {
      return NextResponse.json(
        { error: "Cannot delete an event that has associated invoice line items. Remove the line items first." },
        { status: 400 }
      );
    }

    const scopedDb = getScopedDb(session.user.organizationId);
    await scopedDb.event.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }
}
