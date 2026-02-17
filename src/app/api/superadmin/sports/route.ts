import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const createSportSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
})

export async function GET() {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sports = await db.sport.findMany({
      include: {
        _count: {
          select: { organizations: true },
        },
      },
      orderBy: { displayOrder: "asc" },
    })

    return NextResponse.json(sports)
  } catch (error) {
    console.error("Error fetching sports:", error)
    return NextResponse.json(
      { error: "Failed to fetch sports" },
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
    const validatedData = createSportSchema.parse(body)

    const existingSport = await db.sport.findUnique({
      where: { slug: validatedData.slug },
    })

    if (existingSport) {
      return NextResponse.json(
        { error: "A sport with this slug already exists" },
        { status: 400 }
      )
    }

    const sport = await db.sport.create({
      data: {
        name: validatedData.name,
        slug: validatedData.slug,
        description: validatedData.description,
        icon: validatedData.icon,
        isActive: validatedData.isActive ?? true,
        displayOrder: validatedData.displayOrder ?? 0,
      },
    })

    return NextResponse.json(sport, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors?.[0]?.message || "Validation error"
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error("Error creating sport:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create sport" },
      { status: 500 }
    )
  }
}
