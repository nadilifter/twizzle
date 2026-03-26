import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";

// GET /api/calendar/instances - Get program instances for calendar view
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // Date range parameters
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    
    // Default to current month +/- 1 month if no dates provided
    const now = new Date();
    const start = startParam ? new Date(startParam) : startOfMonth(subMonths(now, 1));
    const end = endParam ? new Date(endParam) : endOfMonth(addMonths(now, 1));

    // Optional filters
    const programId = searchParams.get("programId");
    const facilityId = searchParams.get("facilityId");
    const status = searchParams.get("status");
    const categoryId = searchParams.get("categoryId");

    // Build where clause
    const where: any = {
      organizationId: session.user.organizationId,
      date: {
        gte: start,
        lte: end,
      },
    };

    if (programId) {
      where.programId = programId;
    }

    if (facilityId) {
      where.facilityId = facilityId;
    }

    if (status) {
      where.status = status;
    }

    if (categoryId) {
      where.program = { categoryId };
    }

    const instances = await db.programInstance.findMany({
      where,
      include: {
        program: {
          select: {
            id: true,
            name: true,
            color: true,
            registrationType: true,
            basePrice: true,
            perSessionPrice: true,
            categoryId: true,
          },
        },
        facility: {
          select: { id: true, name: true, city: true },
        },
        _count: {
          select: { registrations: true, attendances: true },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    // Transform to calendar event format
    const events = instances.map((instance) => ({
      id: instance.id,
      title: instance.program.name,
      start: instance.date,
      startTime: instance.startTime,
      endTime: instance.endTime,
      status: instance.status,
      programId: instance.programId,
      programName: instance.program.name,
      facilityId: instance.facilityId,
      facilityName: instance.facility?.name || null,
      capacity: instance.capacity,
      registrationCount: instance._count.registrations,
      attendanceCount: instance._count.attendances,
      color: instance.program.color,
      levelName: null,
      registrationType: instance.program.registrationType,
      categoryId: instance.program.categoryId || null,
      isSoldOut: false,
      isWaitlistAvailable: false,
    }));

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error fetching calendar instances:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar instances" },
      { status: 500 }
    );
  }
}
