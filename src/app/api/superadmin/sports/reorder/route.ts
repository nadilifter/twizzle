import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const reorderSchema = z.object({
  sports: z.array(z.object({
    id: z.string(),
    displayOrder: z.number().int().nonnegative(),
  })),
})

// POST /api/superadmin/sports/reorder - Bulk update sport order
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { sports } = reorderSchema.parse(body)

    await db.$transaction(
      sports.map((sport) =>
        db.sport.update({
          where: { id: sport.id },
          data: { displayOrder: sport.displayOrder },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Error reordering sports:", error)
    return NextResponse.json(
      { error: "Failed to reorder sports" },
      { status: 500 }
    )
  }
}
