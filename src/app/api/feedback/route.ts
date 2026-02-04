import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const submitFeedbackSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().min(10, "Description must be at least 10 characters").max(5000, "Description too long"),
  categories: z.array(z.string()).default([]),
})

// GET /api/feedback
// List public features (isPublic=true, status!=SUBMITTED)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const status = searchParams.get("status")
    const search = searchParams.get("search") || ""
    const sortBy = searchParams.get("sortBy") || "votes" // votes, newest, targetDate
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    // Get current user for checking if they voted
    const session = await getAuthSession()
    const userId = session?.user?.id

    const where = {
      isPublic: true,
      status: {
        not: "SUBMITTED" as const,
      },
      ...(category && {
        categories: {
          has: category,
        },
      }),
      ...(status && status !== "all" && {
        status: status as "PLANNED" | "IN_PROGRESS" | "DONE" | "CLOSED",
      }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    }

    // Determine sort order
    let orderBy: any = {}
    switch (sortBy) {
      case "newest":
        orderBy = { createdAt: "desc" }
        break
      case "targetDate":
        orderBy = { targetDate: "asc" }
        break
      case "votes":
      default:
        // Will be sorted after fetching with vote count
        orderBy = { createdAt: "desc" }
        break
    }

    const [features, total] = await Promise.all([
      db.featureRequest.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, avatar: true },
          },
          _count: {
            select: { votes: true, comments: true },
          },
          ...(userId && {
            votes: {
              where: { userId },
              select: { id: true },
            },
          }),
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      db.featureRequest.count({ where }),
    ])

    // Transform the data
    let transformedFeatures = features.map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      status: f.status,
      categories: f.categories,
      targetDate: f.targetDate,
      statusChangedAt: f.statusChangedAt,
      createdAt: f.createdAt,
      author: f.user ? {
        id: f.user.id,
        name: f.user.name,
        avatar: f.user.avatar,
      } : null,
      voteCount: f._count.votes,
      commentCount: f._count.comments,
      hasVoted: userId ? (f as any).votes?.length > 0 : false,
    }))

    // Sort by votes if requested
    if (sortBy === "votes") {
      transformedFeatures = transformedFeatures.sort((a, b) => b.voteCount - a.voteCount)
    }

    return NextResponse.json({
      data: transformedFeatures,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error fetching feedback:", error)
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    )
  }
}

// POST /api/feedback
// Submit new feedback (requires auth)
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = submitFeedbackSchema.parse(body)

    const feature = await db.featureRequest.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        categories: validatedData.categories,
        status: "SUBMITTED",
        isPublic: false, // Requires approval to be public
        userId: session.user.id,
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: "Feedback submitted successfully! It will be reviewed by our team.",
      data: {
        id: feature.id,
        title: feature.title,
        description: feature.description,
        status: feature.status,
        categories: feature.categories,
        createdAt: feature.createdAt,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Error submitting feedback:", error)
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    )
  }
}
