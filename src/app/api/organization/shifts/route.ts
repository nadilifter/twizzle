import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createShiftSchema = z.object({
  staffProfileId: z.string().min(1, "Staff profile is required"),
  facilityId: z.string().optional().nullable(),
  date: z.string().min(1, "Date is required"), // ISO date string
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time must be in HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time must be in HH:MM format"),
  shiftType: z.string().min(1, "Shift type is required"),
  notes: z.string().optional().nullable(),
  status: z.enum(["SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
});

// GET - List all shifts for the organization
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
    const staffProfileId = searchParams.get("staffProfileId");
    const facilityId = searchParams.get("facilityId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");

    const shifts = await db.shift.findMany({
      where: {
        organizationId,
        ...(staffProfileId && { staffProfileId }),
        ...(facilityId && { facilityId }),
        ...(status && { status: status as "SCHEDULED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW" }),
        ...(startDate && {
          date: {
            gte: new Date(startDate),
          },
        }),
        ...(endDate && {
          date: {
            lte: new Date(endDate),
          },
        }),
      },
      include: {
        staffProfile: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        facility: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { date: "asc" },
        { startTime: "asc" },
      ],
    });

    return NextResponse.json(shifts);
  } catch (error) {
    console.error("Error fetching shifts:", error);
    return NextResponse.json({ error: "Failed to fetch shifts" }, { status: 500 });
  }
}

// POST - Create a new shift
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
    const validatedData = createShiftSchema.parse(body);

    // Verify staff profile belongs to organization
    const staffProfile = await db.staffProfile.findFirst({
      where: { id: validatedData.staffProfileId, organizationId },
    });

    if (!staffProfile) {
      return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
    }

    // Verify facility belongs to organization if provided
    if (validatedData.facilityId) {
      const facility = await db.facility.findFirst({
        where: { id: validatedData.facilityId, organizationId },
      });

      if (!facility) {
        return NextResponse.json({ error: "Facility not found" }, { status: 404 });
      }
    }

    const shift = await db.shift.create({
      data: {
        organizationId,
        staffProfileId: validatedData.staffProfileId,
        facilityId: validatedData.facilityId ?? null,
        date: new Date(validatedData.date),
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        shiftType: validatedData.shiftType,
        notes: validatedData.notes ?? null,
        status: validatedData.status || "SCHEDULED",
      },
      include: {
        staffProfile: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        facility: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating shift:", error);
    return NextResponse.json({ error: "Failed to create shift" }, { status: 500 });
  }
}
