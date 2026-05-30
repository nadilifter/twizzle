import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { z } from "zod";

void getScopedDb;

const updateSeasonSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  scSeasonGuid: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateSeasonSchema.parse(body);

    const existing = await db.skateCanadaSeason.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    if (validatedData.name && validatedData.name !== existing.name) {
      const nameConflict = await db.skateCanadaSeason.findUnique({
        where: { name: validatedData.name },
      });
      if (nameConflict) {
        return NextResponse.json(
          { error: "A season with this name already exists" },
          { status: 400 }
        );
      }
    }

    const isActivating = validatedData.isActive === true && !existing.isActive;

    let season;
    if (isActivating) {
      season = await db.$transaction(async (tx) => {
        await tx.skateCanadaSeason.updateMany({ data: { isActive: false } });
        return tx.skateCanadaSeason.update({
          where: { id },
          data: {
            ...(validatedData.name !== undefined && { name: validatedData.name }),
            ...(validatedData.startDate !== undefined && {
              startDate: new Date(validatedData.startDate),
            }),
            ...(validatedData.endDate !== undefined && {
              endDate: new Date(validatedData.endDate),
            }),
            isActive: true,
            ...(validatedData.scSeasonGuid !== undefined && {
              scSeasonGuid: validatedData.scSeasonGuid,
            }),
          },
        });
      });
    } else {
      season = await db.skateCanadaSeason.update({
        where: { id },
        data: {
          ...(validatedData.name !== undefined && { name: validatedData.name }),
          ...(validatedData.startDate !== undefined && {
            startDate: new Date(validatedData.startDate),
          }),
          ...(validatedData.endDate !== undefined && {
            endDate: new Date(validatedData.endDate),
          }),
          ...(validatedData.isActive !== undefined && { isActive: validatedData.isActive }),
          ...(validatedData.scSeasonGuid !== undefined && {
            scSeasonGuid: validatedData.scSeasonGuid,
          }),
        },
      });
    }

    return NextResponse.json(season);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues?.[0]?.message || "Validation error";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Error updating season:", error);
    return NextResponse.json({ error: "Failed to update season" }, { status: 500 });
  }
}
