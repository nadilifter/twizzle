import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { containsProfanity } from "@/lib/profanity"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get("name")

    if (!name) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      )
    }

    const trimmedName = name.trim()

    if (!trimmedName) {
      return NextResponse.json({
        available: false,
        reason: "Organization name is required",
      })
    }

    if (containsProfanity(trimmedName)) {
      return NextResponse.json({
        available: false,
        reason: "Organization name contains inappropriate language",
      })
    }

    // tenant-isolation-ok: public signup endpoint checking global uniqueness
    const existingOrg = await db.organization.findFirst({
      where: {
        name: { equals: trimmedName, mode: "insensitive" },
      },
      select: { id: true },
    })

    if (existingOrg) {
      return NextResponse.json({
        available: false,
        reason: "An organization with this name already exists",
      })
    }

    return NextResponse.json({ available: true })
  } catch (error) {
    console.error("Org name check error:", error)
    return NextResponse.json(
      { error: "Failed to check organization name availability" },
      { status: 500 }
    )
  }
}
