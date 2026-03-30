import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

/**
 * GET /api/superadmin/sports/[id]/events
 * Returns all events for a sport with eligibility data.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sportId } = await params;

    const sport = await db.sport.findUnique({
      where: { id: sportId },
      select: { id: true, name: true, slug: true },
    });
    if (!sport) {
      return NextResponse.json({ error: "Sport not found" }, { status: 404 });
    }

    const events = await db.sportEvent.findMany({
      where: { sportId },
      include: {
        eligibility: {
          include: {
            ageCategory: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    const ageCategories = await db.sportAgeCategory.findMany({
      where: { sportId },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({ sport, events, ageCategories });
  } catch (error) {
    console.error("Error fetching sport events:", error);
    return NextResponse.json({ error: "Failed to fetch sport events" }, { status: 500 });
  }
}

const createEventSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  eventGroup: z.string().min(1, "Event group is required"),
  eventType: z.string().min(1, "Event type is required"),
  resultType: z.enum(["TIME", "DISTANCE", "HEIGHT", "SCORE"]),
  sortDirection: z.enum(["ASC", "DESC"]),
  defaultPrecision: z.number().int().min(0).max(6).default(3),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});

/**
 * POST /api/superadmin/sports/[id]/events
 * Create a new event for a sport.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sportId } = await params;
    const body = await request.json();
    const data = createEventSchema.parse(body);

    const sport = await db.sport.findUnique({ where: { id: sportId } });
    if (!sport) {
      return NextResponse.json({ error: "Sport not found" }, { status: 404 });
    }

    const event = await db.sportEvent.create({
      data: { ...data, sportId },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues?.[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error creating sport event:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}

const batchUpdateSchema = z.object({
  events: z
    .array(
      z.object({
        id: z.string(),
        isActive: z.boolean().optional(),
        displayOrder: z.number().int().optional(),
      })
    )
    .optional(),
});

/**
 * PATCH /api/superadmin/sports/[id]/events
 * Batch update events (toggle active, reorder).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sportId } = await params;
    const body = await request.json();
    const data = batchUpdateSchema.parse(body);

    if (data.events) {
      await Promise.all(
        data.events.map((evt) => {
          const updateData: Record<string, unknown> = {};
          if (evt.isActive !== undefined) updateData.isActive = evt.isActive;
          if (evt.displayOrder !== undefined) updateData.displayOrder = evt.displayOrder;
          return db.sportEvent.update({
            where: { id: evt.id },
            data: updateData,
          });
        })
      );
    }

    const events = await db.sportEvent.findMany({
      where: { sportId },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json(events);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues?.[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error updating sport events:", error);
    return NextResponse.json({ error: "Failed to update events" }, { status: 500 });
  }
}
