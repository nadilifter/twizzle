import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseDateOnly } from "@/lib/date-utils"
import { z } from "zod"

const updateFeatureSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  status: z.enum(["SUBMITTED", "PLANNED", "IN_PROGRESS", "DONE", "CLOSED"]).optional(),
  isPublic: z.boolean().optional(),
  categories: z.array(z.string()).optional(),
  targetDate: z.string().datetime().optional().nullable(),
})

// GET /api/superadmin/feedback/[id]
// Get feature details (superadmin)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params

    const feature = await db.featureRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true, isSuperAdmin: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        votes: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        mergedFrom: {
          select: {
            id: true,
            title: true,
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        mergedInto: {
          select: { id: true, title: true },
        },
      },
    })

    if (!feature) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 })
    }

    return NextResponse.json(feature)
  } catch (error) {
    console.error("Error fetching feature:", error)
    return NextResponse.json(
      { error: "Failed to fetch feature" },
      { status: 500 }
    )
  }
}

// PUT /api/superadmin/feedback/[id]
// Update feature (status, categories, targetDate, isPublic)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateFeatureSchema.parse(body)

    // Check if feature exists
    const existingFeature = await db.featureRequest.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!existingFeature) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 })
    }

    // Track if status changed
    const statusChanged = validatedData.status && validatedData.status !== existingFeature.status

    const feature = await db.featureRequest.update({
      where: { id },
      data: {
        ...(validatedData.title !== undefined && { title: validatedData.title }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.status !== undefined && { status: validatedData.status }),
        ...(validatedData.isPublic !== undefined && { isPublic: validatedData.isPublic }),
        ...(validatedData.categories !== undefined && { categories: validatedData.categories }),
        ...(validatedData.targetDate !== undefined && { 
          targetDate: validatedData.targetDate ? parseDateOnly(validatedData.targetDate) : null 
        }),
        // Update statusChangedAt if status changed
        ...(statusChanged && { statusChangedAt: new Date() }),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        _count: {
          select: { votes: true, comments: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: feature,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Error updating feature:", error)
    return NextResponse.json(
      { error: "Failed to update feature" },
      { status: 500 }
    )
  }
}

// DELETE /api/superadmin/feedback/[id]
// Delete feature
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params

    // Check if feature exists
    const feature = await db.featureRequest.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!feature) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 })
    }

    // Delete the feature (cascades to votes and comments)
    await db.featureRequest.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: "Feature deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting feature:", error)
    return NextResponse.json(
      { error: "Failed to delete feature" },
      { status: 500 }
    )
  }
}
