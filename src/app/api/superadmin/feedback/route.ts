import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const createFeatureSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().min(1, "Description is required").max(5000, "Description too long"),
  status: z.enum(["SUBMITTED", "PLANNED", "IN_PROGRESS", "DONE", "CLOSED"]).default("PLANNED"),
  isPublic: z.boolean().default(true),
  categories: z.array(z.string()).default([]),
  targetDate: z.string().datetime().optional().nullable(),
})

// GET /api/superadmin/feedback
// List all features (both submissions and approved)
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const tab = searchParams.get("tab") || "all" // all, submissions, live
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "100")
    const offset = parseInt(searchParams.get("offset") || "0")

    let where: any = {}

    // Filter by tab
    if (tab === "submissions") {
      where = {
        status: "SUBMITTED",
        isPublic: false,
      }
    } else if (tab === "live") {
      where = {
        isPublic: true,
      }
    }

    // Add search filter
    if (search) {
      where = {
        ...where,
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }
    }

    // Add status filter
    if (status && status !== "all") {
      where.status = status
    }

    const [features, total] = await Promise.all([
      db.featureRequest.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          _count: {
            select: { votes: true, comments: true, mergedFrom: true },
          },
        },
        orderBy: [
          { createdAt: "desc" },
        ],
        take: limit,
        skip: offset,
      }),
      db.featureRequest.count({ where }),
    ])

    return NextResponse.json({
      data: features.map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description,
        status: f.status,
        isPublic: f.isPublic,
        categories: f.categories,
        targetDate: f.targetDate,
        statusChangedAt: f.statusChangedAt,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        author: f.user ? {
          id: f.user.id,
          name: f.user.name,
          email: f.user.email,
          avatar: f.user.avatar,
        } : null,
        voteCount: f._count.votes,
        commentCount: f._count.comments,
        mergedCount: f._count.mergedFrom,
      })),
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error fetching feedback for superadmin:", error)
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    )
  }
}

// POST /api/superadmin/feedback
// Create a new feature directly (superadmin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createFeatureSchema.parse(body)

    const feature = await db.featureRequest.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        status: validatedData.status,
        isPublic: validatedData.isPublic,
        categories: validatedData.categories,
        targetDate: validatedData.targetDate ? new Date(validatedData.targetDate) : null,
        statusChangedAt: new Date(),
        userId: session.user.id, // Created by superadmin
      },
    })

    return NextResponse.json({
      success: true,
      data: feature,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error creating feature:", error)
    return NextResponse.json(
      { error: "Failed to create feature" },
      { status: 500 }
    )
  }
}
