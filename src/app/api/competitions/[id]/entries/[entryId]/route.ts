import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { checkFeatureGate } from "@/lib/feature-resolver"
import { db } from "@/lib/db"
import { z } from "zod"

const updateEntrySchema = z.object({
  status: z.enum(["PENDING_SEED", "PENDING_REVIEW", "APPROVED", "REJECTED", "WITHDRAWN", "SCRATCHED"]).optional(),
  seedHours: z.number().int().min(0).nullable().optional(),
  seedMinutes: z.number().int().min(0).max(59).nullable().optional(),
  seedSeconds: z.number().int().min(0).max(59).nullable().optional(),
  seedMs: z.number().int().min(0).max(999).nullable().optional(),
  seedHandTimed: z.boolean().optional(),
  seedDistance: z.number().nullable().optional(),
  seedPoints: z.number().nullable().optional(),
  seedPlacement: z.string().nullable().optional(),
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

    const hasSeedFieldUpdate =
      data.seedHours !== undefined ||
      data.seedMinutes !== undefined ||
      data.seedSeconds !== undefined ||
      data.seedMs !== undefined ||
      data.seedDistance !== undefined ||
      data.seedPoints !== undefined ||
      data.seedPlacement !== undefined

    if (data.seedHours !== undefined) updateData.seedHours = data.seedHours
    if (data.seedMinutes !== undefined) updateData.seedMinutes = data.seedMinutes
    if (data.seedSeconds !== undefined) updateData.seedSeconds = data.seedSeconds
    if (data.seedMs !== undefined) updateData.seedMs = data.seedMs
    if (data.seedHandTimed !== undefined) updateData.seedHandTimed = data.seedHandTimed
    if (data.seedDistance !== undefined) updateData.seedDistance = data.seedDistance
    if (data.seedPoints !== undefined) updateData.seedPoints = data.seedPoints
    if (data.seedPlacement !== undefined) updateData.seedPlacement = data.seedPlacement

    if (hasSeedFieldUpdate) {
      updateData.seedMarkSubmittedAt = new Date()
    }

    if (data.seedMarkStatus !== undefined) {
      updateData.seedMarkStatus = data.seedMarkStatus
      updateData.seedMarkReviewedAt = new Date()
      updateData.seedMarkReviewedBy = session.user.id

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
      where: { id: entryId, competitionId: id },
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
