import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

/**
 * GET /api/superadmin/sports/[id]/age-categories
 * Returns all age categories for a sport.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: sportId } = await params

    const sport = await db.sport.findUnique({
      where: { id: sportId },
      select: { id: true, name: true, slug: true },
    })
    if (!sport) {
      return NextResponse.json({ error: "Sport not found" }, { status: 404 })
    }

    const ageCategories = await db.sportAgeCategory.findMany({
      where: { sportId },
      orderBy: { displayOrder: "asc" },
    })

    return NextResponse.json({ sport, ageCategories })
  } catch (error) {
    console.error("Error fetching age categories:", error)
    return NextResponse.json(
      { error: "Failed to fetch age categories" },
      { status: 500 }
    )
  }
}

const createAgeCategorySchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  minAge: z.number().int().min(0),
  maxAge: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
})

/**
 * POST /api/superadmin/sports/[id]/age-categories
 * Create a new age category for a sport.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: sportId } = await params
    const body = await request.json()
    const data = createAgeCategorySchema.parse(body)

    const sport = await db.sport.findUnique({ where: { id: sportId } })
    if (!sport) {
      return NextResponse.json({ error: "Sport not found" }, { status: 404 })
    }

    const ageCategory = await db.sportAgeCategory.create({
      data: { ...data, sportId },
    })

    return NextResponse.json(ageCategory, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues?.[0]?.message || "Validation error" }, { status: 400 })
    }
    console.error("Error creating age category:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create age category" },
      { status: 500 }
    )
  }
}
