import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const axisValueSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  axis: z.enum(["ROW", "COLUMN"]),
  displayOrder: z.number().int().default(0),
  minAge: z.number().int().min(0).max(100).optional().nullable(),
  maxAge: z.number().int().min(0).max(100).optional().nullable(),
  allowedGenders: z.array(z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"])).optional().default([]),
})

const combinationEntrySchema = z.object({
  rowValueIndex: z.number().int().min(0),
  colValueIndex: z.number().int().min(0),
  isActive: z.boolean().default(true),
  name: z.string().optional().nullable(),
})

const individualEntrySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  displayOrder: z.number().int().default(0),
  hasGenderRestriction: z.boolean().default(false),
  hasAgeRestriction: z.boolean().default(false),
  hasCapacityRestriction: z.boolean().default(false),
  allowedGenders: z.array(z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"])).optional().default([]),
  minAge: z.number().int().min(0).max(100).optional().nullable(),
  maxAge: z.number().int().min(0).max(100).optional().nullable(),
  capacity: z.number().int().min(1).optional().nullable(),
})

const createTemplateSchema = z.object({
  sportId: z.string().min(1, "Sport is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  type: z.enum(["COMBINATION", "INDIVIDUAL"]),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  // COMBINATION specific
  rowAxisLabel: z.string().optional().nullable(),
  columnAxisLabel: z.string().optional().nullable(),
  restrictionAxis: z.enum(["ROW", "COLUMN"]).optional().nullable(),
  axisValues: z.array(axisValueSchema).optional().default([]),
  disabledCombinations: z.array(combinationEntrySchema).optional().default([]),
  // INDIVIDUAL specific
  individualEntries: z.array(individualEntrySchema).optional().default([]),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sportId = searchParams.get("sportId")

    const where: Record<string, unknown> = {
      sportId: sportId ? sportId : { not: null },
      organizationId: null,
    }

    const templates = await db.competitionCategoryTemplate.findMany({
      where,
      include: {
        sport: { select: { id: true, name: true, slug: true } },
        axisValues: { orderBy: { displayOrder: "asc" } },
        combinationEntries: true,
        individualEntries: { orderBy: { displayOrder: "asc" } },
      },
      orderBy: { displayOrder: "asc" },
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error("Error fetching competition category templates:", error)
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createTemplateSchema.parse(body)

    // Verify sport exists
    const sport = await db.sport.findUnique({ where: { id: data.sportId } })
    if (!sport) {
      return NextResponse.json({ error: "Sport not found" }, { status: 404 })
    }

    if (data.type === "COMBINATION") {
      // Create template with axis values and combination entries
      const rowValues = data.axisValues.filter((v) => v.axis === "ROW")
      const colValues = data.axisValues.filter((v) => v.axis === "COLUMN")

      const template = await db.competitionCategoryTemplate.create({
        data: {
          sportId: data.sportId,
          name: data.name,
          description: data.description,
          type: "COMBINATION",
          isActive: data.isActive,
          displayOrder: data.displayOrder,
          rowAxisLabel: data.rowAxisLabel,
          columnAxisLabel: data.columnAxisLabel,
          restrictionAxis: data.restrictionAxis,
          axisValues: {
            create: data.axisValues.map((v) => ({
              axis: v.axis,
              name: v.name,
              displayOrder: v.displayOrder,
              minAge: v.minAge,
              maxAge: v.maxAge,
              allowedGenders: v.allowedGenders,
            })),
          },
        },
        include: {
          axisValues: { orderBy: { displayOrder: "asc" } },
        },
      })

      // Create combination entries for all row x column pairs
      const createdRows = template.axisValues.filter((v) => v.axis === "ROW")
      const createdCols = template.axisValues.filter((v) => v.axis === "COLUMN")

      // Build a set of disabled combinations
      const disabledSet = new Set(
        data.disabledCombinations
          .filter((c) => !c.isActive)
          .map((c) => `${c.rowValueIndex}:${c.colValueIndex}`)
      )

      const combEntries = []
      for (let ri = 0; ri < createdRows.length; ri++) {
        for (let ci = 0; ci < createdCols.length; ci++) {
          const isActive = !disabledSet.has(`${ri}:${ci}`)
          combEntries.push({
            templateId: template.id,
            rowValueId: createdRows[ri].id,
            colValueId: createdCols[ci].id,
            isActive,
            name: `${createdRows[ri].name} - ${createdCols[ci].name}`,
          })
        }
      }

      if (combEntries.length > 0) {
        await db.categoryCombinationEntry.createMany({ data: combEntries })
      }

      // Return full template
      const fullTemplate = await db.competitionCategoryTemplate.findUnique({
        where: { id: template.id },
        include: {
          sport: { select: { id: true, name: true, slug: true } },
          axisValues: { orderBy: { displayOrder: "asc" } },
          combinationEntries: true,
          individualEntries: { orderBy: { displayOrder: "asc" } },
        },
      })

      return NextResponse.json(fullTemplate, { status: 201 })
    } else {
      // INDIVIDUAL template
      const template = await db.competitionCategoryTemplate.create({
        data: {
          sportId: data.sportId,
          name: data.name,
          description: data.description,
          type: "INDIVIDUAL",
          isActive: data.isActive,
          displayOrder: data.displayOrder,
          individualEntries: {
            create: data.individualEntries.map((e) => ({
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
            })),
          },
        },
        include: {
          sport: { select: { id: true, name: true, slug: true } },
          axisValues: { orderBy: { displayOrder: "asc" } },
          combinationEntries: true,
          individualEntries: { orderBy: { displayOrder: "asc" } },
        },
      })

      return NextResponse.json(template, { status: 201 })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors?.[0]?.message || "Validation error"
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error("Error creating competition category template:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create template" },
      { status: 500 }
    )
  }
}
