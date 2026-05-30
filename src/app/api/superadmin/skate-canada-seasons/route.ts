import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { z } from "zod";

void getScopedDb;

const createSeasonSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isActive: z.boolean().optional().default(false),
  scSeasonGuid: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const seasons = await db.skateCanadaSeason.findMany({
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        isActive: true,
        scSeasonGuid: true,
        createdAt: true,
      },
    });

    return NextResponse.json(seasons);
  } catch (error) {
    console.error("Error fetching seasons:", error);
    return NextResponse.json({ error: "Failed to fetch seasons" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createSeasonSchema.parse(body);

    const existing = await db.skateCanadaSeason.findUnique({
      where: { name: validatedData.name },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A season with this name already exists" },
        { status: 400 }
      );
    }

    let season;
    if (validatedData.isActive) {
      season = await db.$transaction(async (tx) => {
        await tx.skateCanadaSeason.updateMany({ data: { isActive: false } });
        return tx.skateCanadaSeason.create({
          data: {
            name: validatedData.name,
            startDate: new Date(validatedData.startDate),
            endDate: new Date(validatedData.endDate),
            isActive: true,
            scSeasonGuid: validatedData.scSeasonGuid ?? null,
          },
        });
      });
    } else {
      season = await db.skateCanadaSeason.create({
        data: {
          name: validatedData.name,
          startDate: new Date(validatedData.startDate),
          endDate: new Date(validatedData.endDate),
          isActive: false,
          scSeasonGuid: validatedData.scSeasonGuid ?? null,
        },
      });
    }

    return NextResponse.json(season, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues?.[0]?.message || "Validation error";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Error creating season:", error);
    return NextResponse.json({ error: "Failed to create season" }, { status: 500 });
  }
}
