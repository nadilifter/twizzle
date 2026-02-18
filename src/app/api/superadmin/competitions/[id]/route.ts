import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * DELETE /api/superadmin/competitions/[id]
 * Force-delete any competition regardless of status (superadmin only).
 * Nullifies LineItem references before deletion so cascades succeed.
 */
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

    const existing = await db.competition.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 })
    }

    await db.$transaction([
      db.lineItem.updateMany({
        where: { competitionId: id },
        data: { competitionId: null, competitionCategoryId: null },
      }),
      db.competition.delete({ where: { id } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting competition:", error)
    return NextResponse.json(
      { error: "Failed to delete competition" },
      { status: 500 }
    )
  }
}
