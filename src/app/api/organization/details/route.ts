import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"

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

    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        street: true,
        city: true,
        stateProvince: true,
        postalCode: true,
        country: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
            organizationAthletes: true,
            programs: true,
          },
        },
        subscription: {
          select: {
            status: true,
            plan: {
              select: { name: true },
            },
          },
        },
        sports: {
          include: {
            sport: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                icon: true,
              },
            },
          },
          orderBy: { sport: { displayOrder: "asc" } },
        },
      },
    })

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    return NextResponse.json(organization)
  } catch (error) {
    console.error("Failed to fetch organization details:", error)
    return NextResponse.json(
      { error: "Failed to fetch organization details" },
      { status: 500 }
    )
  }
}
