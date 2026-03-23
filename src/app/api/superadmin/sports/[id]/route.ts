import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const updateSportSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const sport = await db.sport.findUnique({
      where: { id },
      include: {
        organizations: {
          include: {
            organization: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        _count: {
          select: { organizations: true },
        },
      },
    })

    if (!sport) {
      return NextResponse.json({ error: "Sport not found" }, { status: 404 })
    }

    return NextResponse.json(sport)
  } catch (error) {
    console.error("Error fetching sport:", error)
    return NextResponse.json(
      { error: "Failed to fetch sport" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateSportSchema.parse(body)

    const existingSport = await db.sport.findUnique({ where: { id } })
    if (!existingSport) {
      return NextResponse.json({ error: "Sport not found" }, { status: 404 })
    }

    if (validatedData.slug && validatedData.slug !== existingSport.slug) {
      const slugConflict = await db.sport.findUnique({
        where: { slug: validatedData.slug },
      })
      if (slugConflict) {
        return NextResponse.json(
          { error: "A sport with this slug already exists" },
          { status: 400 }
        )
      }
    }

    if (validatedData.name && validatedData.name !== existingSport.name) {
      const nameConflict = await db.sport.findUnique({
        where: { name: validatedData.name },
      })
      if (nameConflict) {
        return NextResponse.json(
          { error: "A sport with this name already exists" },
          { status: 400 }
        )
      }
    }

    const sport = await db.sport.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json(sport)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues?.[0]?.message || "Validation error"
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error("Error updating sport:", error)
    return NextResponse.json(
      { error: "Failed to update sport" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const orgCount = await db.organizationSport.count({
      where: { sportId: id },
    })

    if (orgCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete sport used by ${orgCount} organization(s). Deactivate it instead.` },
        { status: 400 }
      )
    }

    await db.sport.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting sport:", error)
    return NextResponse.json(
      { error: "Failed to delete sport" },
      { status: 500 }
    )
  }
}
