import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const generateShiftsSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  overwriteExisting: z.boolean().optional(), // If true, delete existing shifts in date range
});

// POST - Generate shifts from a schedule template
export async function POST(
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
      !session.user.permissions.includes("schedules.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify template exists in organization
    const template = await db.scheduleTemplate.findFirst({
      where: { id, organizationId },
      include: {
        entries: true,
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Schedule template not found" }, { status: 404 });
    }

    if (template.entries.length === 0) {
      return NextResponse.json({ error: "Template has no entries to generate shifts from" }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = generateShiftsSchema.parse(body);

    const startDate = new Date(validatedData.startDate);
    const endDate = new Date(validatedData.endDate);

    if (startDate > endDate) {
      return NextResponse.json({ error: "Start date must be before end date" }, { status: 400 });
    }

    // Limit to 90 days max for safety
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      return NextResponse.json({ error: "Date range cannot exceed 90 days" }, { status: 400 });
    }

    // Optionally delete existing shifts in the date range
    if (validatedData.overwriteExisting) {
      await db.shift.deleteMany({
        where: {
          organizationId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
    }

    // Generate shifts for each day in the range
    const shiftsToCreate: Array<{
      organizationId: string;
      memberId: string;
      facilityId: string | null;
      date: Date;
      startTime: string;
      endTime: string;
      shiftType: string;
      status: "SCHEDULED";
    }> = [];

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday

      // Find entries for this day of the week
      const entriesForDay = template.entries.filter((entry) => entry.dayOfWeek === dayOfWeek);

      for (const entry of entriesForDay) {
        // Only create shifts for entries that have staff assigned
        if (entry.memberId) {
          shiftsToCreate.push({
            organizationId,
            memberId: entry.memberId,
            facilityId: entry.facilityId,
            date: new Date(currentDate),
            startTime: entry.startTime,
            endTime: entry.endTime,
            shiftType: entry.shiftType,
            status: "SCHEDULED",
          });
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (shiftsToCreate.length === 0) {
      return NextResponse.json({ 
        message: "No shifts generated. Make sure template entries have staff assigned.",
        shiftsCreated: 0,
      });
    }

    // Create all shifts
    const result = await db.shift.createMany({
      data: shiftsToCreate,
    });

    return NextResponse.json({
      message: `Successfully generated ${result.count} shifts`,
      shiftsCreated: result.count,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error generating shifts from template:", error);
    return NextResponse.json({ error: "Failed to generate shifts" }, { status: 500 });
  }
}
