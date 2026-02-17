import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { checkFeatureGate } from "@/lib/feature-resolver"
import { db } from "@/lib/db"
import { z } from "zod"

const updateEntrySchema = z.object({
  status: z.enum(["PENDING_SEED", "PENDING_REVIEW", "APPROVED", "REJECTED", "WITHDRAWN", "SCRATCHED"]).optional(),
  seedMark: z.number().nullable().optional(),
  seedMarkStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  seedMarkNotes: z.string().nullable().optional(),
})

/**
 * PATCH /api/competitions/[id]/entries/[entryId]
 * Update a competition entry (approve/reject seed mark, change status).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    if (!organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 })
    }

    const gateResponse = await checkFeatureGate(organizationId, "competitions")
    if (gateResponse) return gateResponse

    const { id, entryId } = await params

    const competition = await db.competition.findFirst({
      where: { id, organizationId },
      select: { id: true },
    })
    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 })
    }

    const existing = await db.competitionEntry.findFirst({
      where: { id: entryId, competitionId: id },
    })
    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    const body = await request.json()
    const data = updateEntrySchema.parse(body)

    const updateData: Record<string, unknown> = {}

    if (data.seedMark !== undefined) {
      updateData.seedMark = data.seedMark
      if (data.seedMark != null) {
        updateData.seedMarkSubmittedAt = new Date()
      }
    }

    if (data.seedMarkStatus !== undefined) {
      updateData.seedMarkStatus = data.seedMarkStatus
      updateData.seedMarkReviewedAt = new Date()
      updateData.seedMarkReviewedBy = session.user.id

      // Auto-update entry status based on seed mark review
      if (data.seedMarkStatus === "APPROVED") {
        updateData.status = "APPROVED"
      } else if (data.seedMarkStatus === "REJECTED") {
        updateData.status = "REJECTED"
      }
    }

    if (data.seedMarkNotes !== undefined) {
      updateData.seedMarkNotes = data.seedMarkNotes
    }

    if (data.status !== undefined) {
      updateData.status = data.status
    }

    const entry = await db.competitionEntry.update({
      where: { id: entryId },
      data: updateData,
      include: {
        athlete: { select: { id: true, firstName: true, lastName: true, name: true } },
        category: true,
      },
    })

    return NextResponse.json(entry)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues?.[0]?.message || "Validation error" }, { status: 400 })
    }
    console.error("Error updating entry:", error)
    return NextResponse.json(
      { error: "Failed to update entry" },
      { status: 500 }
    )
  }
}
