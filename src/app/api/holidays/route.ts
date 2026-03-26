import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";
import { seedHolidaysForYear } from "@/lib/holiday-utils";
import { z } from "zod";

const createHolidaySchema = z.object({
  name: z.string().min(1, "Name is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

// GET /api/holidays?year=2026
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    if (!yearParam) {
      return NextResponse.json(
        { error: "year query parameter is required" },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam);
    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: "Invalid year" },
        { status: 400 }
      );
    }

    const organizationId = session.user.organizationId!;

    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { country: true, stateProvince: true },
    });

    if (org?.country) {
      await seedHolidaysForYear(organizationId, org.country, org.stateProvince, year);
    }

    const scopedDb = getScopedDb(organizationId);
    const holidays = await scopedDb.organizationHoliday.findMany({
      where: { year },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ data: holidays });
  } catch (error) {
    console.error("Error fetching holidays:", error);
    return NextResponse.json(
      { error: "Failed to fetch holidays" },
      { status: 500 }
    );
  }
}

// POST /api/holidays — add custom closure
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validatedData = createHolidaySchema.parse(body);

    const date = parseDateOnly(validatedData.date);
    if (!date) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const year = date.getUTCFullYear();
    const organizationId = session.user.organizationId!;
    const scopedDb = getScopedDb(organizationId);

    const existing = await scopedDb.organizationHoliday.findFirst({
      where: { date, name: validatedData.name },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A holiday with this name and date already exists" },
        { status: 409 }
      );
    }

    const holiday = await scopedDb.organizationHoliday.create({
      data: {
        organizationId,
        date,
        name: validatedData.name,
        type: "CUSTOM",
        isEnabled: true,
        year,
      },
    });

    return NextResponse.json(holiday);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating holiday:", error);
    return NextResponse.json(
      { error: "Failed to create holiday" },
      { status: 500 }
    );
  }
}
