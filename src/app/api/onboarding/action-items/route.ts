import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { getActionItems } from "@/lib/onboarding-actions"

export async function GET() {
  try {
    const session = await getAuthSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    const data = await getActionItems(organizationId)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Failed to fetch action items:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
