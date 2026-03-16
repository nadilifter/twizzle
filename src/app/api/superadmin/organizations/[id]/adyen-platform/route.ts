import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * GET /api/superadmin/organizations/[id]/adyen-platform
 * Returns the Adyen platform account for a given organization (superadmin only).
 */
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

    const account = await db.adyenPlatformAccount.findUnique({
      where: { organizationId: id },
    })

    return NextResponse.json({ account })
  } catch (error) {
    console.error("Failed to fetch Adyen platform account:", error)
    return NextResponse.json(
      { error: "Failed to fetch Adyen platform account" },
      { status: 500 }
    )
  }
}
