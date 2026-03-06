import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const templateEntrySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  shiftType: z.string().min(1, "Shift type is required"),
  memberId: z.string().optional().nullable(),
  facilityId: z.string().optional().nullable(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  isActive: z.boolean().optional(),
  entries: z.array(templateEntrySchema).optional(),
});

// GET - List all schedule templates for the organization
export async function GET(request: NextRequest) {
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
      !session.user.permissions.includes("schedules.view")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get("isActive");

    const templates = await db.scheduleTemplate.findMany({
      where: {
        organizationId,
        ...(isActive !== null && { isActive: isActive === "true" }),
      },
      include: {
        entries: {
          orderBy: [
            { dayOfWeek: "asc" },
            { startTime: "asc" },
          ],
        },
        _count: {
          select: {
            entries: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching schedule templates:", error);
    return NextResponse.json({ error: "Failed to fetch schedule templates" }, { status: 500 });
  }
}

// POST - Create a new schedule template
export async function POST(request: NextRequest) {
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
      !session.user.permissions.includes("schedules.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createTemplateSchema.parse(body);

    const template = await db.scheduleTemplate.create({
      data: {
        organizationId,
        name: validatedData.name,
        isActive: validatedData.isActive ?? true,
        entries: validatedData.entries ? {
          create: validatedData.entries.map((entry) => ({
            dayOfWeek: entry.dayOfWeek,
            startTime: entry.startTime,
            endTime: entry.endTime,
            shiftType: entry.shiftType,
            memberId: entry.memberId ?? null,
            facilityId: entry.facilityId ?? null,
          })),
        } : undefined,
      },
      include: {
        entries: {
          orderBy: [
            { dayOfWeek: "asc" },
            { startTime: "asc" },
          ],
        },
        _count: {
          select: {
            entries: true,
          },
        },
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating schedule template:", error);
    return NextResponse.json({ error: "Failed to create schedule template" }, { status: 500 });
  }
}
