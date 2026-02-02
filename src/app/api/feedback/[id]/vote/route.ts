import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"

// POST /api/feedback/[id]/vote
// Toggle vote on a feature (requires auth)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { id } = await params
    const userId = session.user.id

    // Check if feature exists and is public
    const feature = await db.featureRequest.findUnique({
      where: { id },
      select: { id: true, isPublic: true, status: true },
    })

    if (!feature) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 })
    }

    if (!feature.isPublic) {
      return NextResponse.json({ error: "Cannot vote on this feature" }, { status: 403 })
    }

    // Check if user already voted
    const existingVote = await db.featureVote.findUnique({
      where: {
        featureRequestId_userId: {
          featureRequestId: id,
          userId,
        },
      },
    })

    if (existingVote) {
      // Remove vote (toggle off)
      await db.featureVote.delete({
        where: { id: existingVote.id },
      })

      const newCount = await db.featureVote.count({
        where: { featureRequestId: id },
      })

      return NextResponse.json({
        success: true,
        voted: false,
        voteCount: newCount,
        message: "Vote removed",
      })
    } else {
      // Add vote
      await db.featureVote.create({
        data: {
          featureRequestId: id,
          userId,
        },
      })

      const newCount = await db.featureVote.count({
        where: { featureRequestId: id },
      })

      return NextResponse.json({
        success: true,
        voted: true,
        voteCount: newCount,
        message: "Vote added",
      })
    }
  } catch (error) {
    console.error("Error toggling vote:", error)
    return NextResponse.json(
      { error: "Failed to process vote" },
      { status: 500 }
    )
  }
}
