import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const templateInclude = {
  sport: { select: { id: true, name: true, slug: true } },
  axisValues: { orderBy: { displayOrder: "asc" as const } },
  combinationEntries: true,
  individualEntries: { orderBy: { displayOrder: "asc" as const } },
}

const axisValueSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  axis: z.enum(["ROW", "COLUMN"]),
  displayOrder: z.number().int().default(0),
  minAge: z.number().int().min(0).max(100).optional().nullable(),
  maxAge: z.number().int().min(0).max(100).optional().nullable(),
  allowedGenders: z.array(z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"])).optional().default([]),
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
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  type: z.enum(["COMBINATION", "INDIVIDUAL"]),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  rowAxisLabel: z.string().optional().nullable(),
  columnAxisLabel: z.string().optional().nullable(),
  restrictionAxis: z.enum(["ROW", "COLUMN"]).optional().nullable(),
  axisValues: z.array(axisValueSchema).optional().default([]),
  disabledCombinations: z.array(z.object({
    rowValueIndex: z.number().int().min(0),
    colValueIndex: z.number().int().min(0),
    isActive: z.boolean().default(true),
  })).optional().default([]),
  individualEntries: z.array(individualEntrySchema).optional().default([]),
})

export async function GET() {
  try {
    const session = await getAuthSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    // Get the org's sport IDs
    const orgSports = await db.organizationSport.findMany({
      where: { organizationId },
      select: { sportId: true },
    })
    const sportIds = orgSports.map((os) => os.sportId)

    // Fetch sport-level presets for the org's sports
    const presets = await db.competitionCategoryTemplate.findMany({
      where: {
        sportId: { in: sportIds },
        organizationId: null,
        isActive: true,
      },
      include: templateInclude,
      orderBy: { displayOrder: "asc" },
    })

    // Fetch org-level preferences (disabled overrides for presets)
    const preferences = await db.organizationCategoryPreference.findMany({
      where: { organizationId },
      select: { templateId: true, isDisabled: true },
    })
    const disabledSet = new Set(
      preferences.filter((p) => p.isDisabled).map((p) => p.templateId)
    )

    // Annotate presets with disabled status
    const presetsWithStatus = presets.map((p) => ({
      ...p,
      isDisabledByOrg: disabledSet.has(p.id),
    }))

    // Fetch org-level custom templates
    const custom = await db.competitionCategoryTemplate.findMany({
      where: {
        organizationId,
        sportId: null,
      },
      include: templateInclude,
      orderBy: { displayOrder: "asc" },
    })

    return NextResponse.json({ presets: presetsWithStatus, custom })
  } catch (error) {
    console.error("Error fetching competition categories:", error)
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    const body = await request.json()
    const data = createTemplateSchema.parse(body)

    if (data.type === "COMBINATION") {
      const template = await db.competitionCategoryTemplate.create({
        data: {
          organizationId,
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
        include: { axisValues: { orderBy: { displayOrder: "asc" } } },
      })

      const createdRows = template.axisValues.filter((v) => v.axis === "ROW")
      const createdCols = template.axisValues.filter((v) => v.axis === "COLUMN")

      const disabledSet = new Set(
        data.disabledCombinations
          .filter((c) => !c.isActive)
          .map((c) => `${c.rowValueIndex}:${c.colValueIndex}`)
      )

      const combEntries = []
      for (let ri = 0; ri < createdRows.length; ri++) {
        for (let ci = 0; ci < createdCols.length; ci++) {
          combEntries.push({
            templateId: template.id,
            rowValueId: createdRows[ri].id,
            colValueId: createdCols[ci].id,
            isActive: !disabledSet.has(`${ri}:${ci}`),
            name: `${createdRows[ri].name} - ${createdCols[ci].name}`,
          })
        }
      }

      if (combEntries.length > 0) {
        await db.categoryCombinationEntry.createMany({ data: combEntries })
      }

      const full = await db.competitionCategoryTemplate.findUnique({
        where: { id: template.id },
        include: templateInclude,
      })

      return NextResponse.json(full, { status: 201 })
    } else {
      const template = await db.competitionCategoryTemplate.create({
        data: {
          organizationId,
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
        include: templateInclude,
      })

      return NextResponse.json(template, { status: 201 })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors?.[0]?.message || "Validation error"
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error("Error creating competition category:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create category" },
      { status: 500 }
    )
  }
}
