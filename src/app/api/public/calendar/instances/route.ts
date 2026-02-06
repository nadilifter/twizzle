import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";

// GET /api/public/calendar/instances - Get program instances for public calendar view
// No auth required - resolves organization from site slug
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Slug is required for public access
    const slug = searchParams.get("slug");
    if (!slug) {
      return NextResponse.json(
        { error: "slug parameter is required" },
        { status: 400 }
      );
    }

    // Look up organization by subdomain
    const config = await db.websiteConfig.findUnique({
      where: { subdomain: slug },
      select: { organizationId: true },
    });

    if (!config) {
      return NextResponse.json(
        { error: "Site not found" },
        { status: 404 }
      );
    }

    // Date range parameters
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    // Default to current month +/- 1 month if no dates provided
    const now = new Date();
    const start = startParam
      ? new Date(startParam)
      : startOfMonth(subMonths(now, 1));
    const end = endParam
      ? new Date(endParam)
      : endOfMonth(addMonths(now, 1));

    const instances = await db.programInstance.findMany({
      where: {
        organizationId: config.organizationId,
        date: {
          gte: start,
          lte: end,
        },
        // Public view only shows scheduled instances for active programs
        status: "SCHEDULED",
        program: {
          status: "ACTIVE",
        },
      },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            recurrenceType: true,
            registrationType: true,
            programLevel: {
              select: { id: true, name: true, color: true },
            },
          },
        },
        facility: {
          select: { id: true, name: true, city: true },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    // Transform to calendar event format - no sensitive data
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
      capacity: null,
      registrationCount: 0,
      attendanceCount: 0,
      color: instance.program.programLevel?.color || "#3b82f6",
      levelName: instance.program.programLevel?.name || null,
      recurrenceType: instance.program.recurrenceType,
      registrationType: instance.program.registrationType,
    }));

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error fetching public calendar instances:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar instances" },
      { status: 500 }
    );
  }
}
