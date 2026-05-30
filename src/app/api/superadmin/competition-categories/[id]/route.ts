import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const axisValueSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  axis: z.enum(["ROW", "COLUMN"]),
  displayOrder: z.number().int().default(0),
  minAge: z.number().int().min(0).max(100).optional().nullable(),
  maxAge: z.number().int().min(0).max(100).optional().nullable(),
  allowedGenders: z
    .array(z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]))
    .optional()
    .default([]),
});

const individualEntrySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  displayOrder: z.number().int().default(0),
  hasGenderRestriction: z.boolean().default(false),
  hasAgeRestriction: z.boolean().default(false),
  hasCapacityRestriction: z.boolean().default(false),
  allowedGenders: z
    .array(z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]))
    .optional()
    .default([]),
  minAge: z.number().int().min(0).max(100).optional().nullable(),
  maxAge: z.number().int().min(0).max(100).optional().nullable(),
  capacity: z.number().int().min(1).optional().nullable(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  // COMBINATION specific
  rowAxisLabel: z.string().optional().nullable(),
  columnAxisLabel: z.string().optional().nullable(),
  restrictionAxis: z.enum(["ROW", "COLUMN"]).optional().nullable(),
  axisValues: z.array(axisValueSchema).optional(),
  // Combination entries as a map of "rowValueId:colValueId" -> isActive
  combinationUpdates: z
    .array(
      z.object({
        rowValueId: z.string(),
        colValueId: z.string(),
        isActive: z.boolean(),
      })
    )
    .optional(),
  // INDIVIDUAL specific
  individualEntries: z.array(individualEntrySchema).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const template = await db.competitionCategoryTemplate.findUnique({
      where: { id },
      include: {
        axisValues: { orderBy: { displayOrder: "asc" } },
        combinationEntries: true,
        individualEntries: { orderBy: { displayOrder: "asc" } },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error fetching template:", error);
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const data = updateTemplateSchema.parse(body);

    const existing = await db.competitionCategoryTemplate.findUnique({
      where: { id },
      include: {
        axisValues: true,
        combinationEntries: true,
        individualEntries: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Update base template fields
    await db.competitionCategoryTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        displayOrder: data.displayOrder,
        rowAxisLabel: data.rowAxisLabel,
        columnAxisLabel: data.columnAxisLabel,
        restrictionAxis: data.restrictionAxis,
      },
    });

    // Handle axis values update for COMBINATION templates
    if (existing.type === "COMBINATION" && data.axisValues) {
      const existingIds = existing.axisValues.map((v) => v.id);
      const incomingIds = data.axisValues.filter((v) => v.id).map((v) => v.id!);

      // Delete removed axis values (cascade deletes their combination entries)
      const toDelete = existingIds.filter((eid) => !incomingIds.includes(eid));
      if (toDelete.length > 0) {
        await db.categoryAxisValue.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      // Upsert axis values
      for (const v of data.axisValues) {
        if (v.id && existingIds.includes(v.id)) {
          await db.categoryAxisValue.update({
            where: { id: v.id },
            data: {
              name: v.name,
              axis: v.axis,
              displayOrder: v.displayOrder,
              minAge: v.minAge,
              maxAge: v.maxAge,
              allowedGenders: v.allowedGenders,
            },
          });
        } else {
          await db.categoryAxisValue.create({
            data: {
              templateId: id,
              name: v.name,
              axis: v.axis,
              displayOrder: v.displayOrder,
              minAge: v.minAge,
              maxAge: v.maxAge,
              allowedGenders: v.allowedGenders,
            },
          });
        }
      }

      // Regenerate combination entries
      const updatedValues = await db.categoryAxisValue.findMany({
        where: { templateId: id },
        orderBy: { displayOrder: "asc" },
      });
      const rows = updatedValues.filter((v) => v.axis === "ROW");
      const cols = updatedValues.filter((v) => v.axis === "COLUMN");

      // Delete existing combination entries
      await db.categoryCombinationEntry.deleteMany({
        where: { templateId: id },
      });

      // Rebuild combination entries
      const comboUpdateMap = new Map(
        (data.combinationUpdates || []).map((u) => [`${u.rowValueId}:${u.colValueId}`, u.isActive])
      );

      const combEntries = [];
      for (const row of rows) {
        for (const col of cols) {
          const key = `${row.id}:${col.id}`;
          const isActive = comboUpdateMap.has(key) ? comboUpdateMap.get(key)! : true;
          combEntries.push({
            templateId: id,
            rowValueId: row.id,
            colValueId: col.id,
            isActive,
            name: `${row.name} - ${col.name}`,
          });
        }
      }

      if (combEntries.length > 0) {
        await db.categoryCombinationEntry.createMany({ data: combEntries });
      }
    }

    // Handle individual entries update
    if (existing.type === "INDIVIDUAL" && data.individualEntries) {
      const existingIds = existing.individualEntries.map((e) => e.id);
      const incomingIds = data.individualEntries.filter((e) => e.id).map((e) => e.id!);

      // Delete removed entries
      const toDelete = existingIds.filter((eid) => !incomingIds.includes(eid));
      if (toDelete.length > 0) {
        await db.categoryIndividualEntry.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      // Upsert entries
      for (const e of data.individualEntries) {
        if (e.id && existingIds.includes(e.id)) {
          await db.categoryIndividualEntry.update({
            where: { id: e.id },
            data: {
              name: e.name,
              description: e.description,
              displayOrder: e.displayOrder,
              hasGenderRestriction: e.hasGenderRestriction,
              hasAgeRestriction: e.hasAgeRestriction,
              hasCapacityRestriction: e.hasCapacityRestriction,
              allowedGenders: e.allowedGenders,
              minAge: e.minAge,
              maxAge: e.maxAge,
              capacity: e.capacity,
            },
          });
        } else {
          await db.categoryIndividualEntry.create({
            data: {
              templateId: id,
              name: e.name,
              description: e.description,
              displayOrder: e.displayOrder,
              hasGenderRestriction: e.hasGenderRestriction,
              hasAgeRestriction: e.hasAgeRestriction,
              hasCapacityRestriction: e.hasCapacityRestriction,
              allowedGenders: e.allowedGenders,
              minAge: e.minAge,
              maxAge: e.maxAge,
              capacity: e.capacity,
            },
          });
        }
      }
    }

    // Return full updated template
    const updated = await db.competitionCategoryTemplate.findUnique({
      where: { id },
      include: {
        axisValues: { orderBy: { displayOrder: "asc" } },
        combinationEntries: true,
        individualEntries: { orderBy: { displayOrder: "asc" } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues?.[0]?.message || "Validation error";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Error updating template:", error);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const template = await db.competitionCategoryTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await db.competitionCategoryTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
