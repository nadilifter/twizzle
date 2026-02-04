import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/superadmin/trials - List all trial subscriptions with admin contacts
export async function GET() {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get all trial subscriptions
    const subscriptions = await db.organizationSubscription.findMany({
      where: {
        status: "TRIALING"
      },
      include: {
        organization: {
          select: { 
            id: true, 
            name: true, 
            slug: true,
            members: {
              where: {
                role: "ADMIN",
                status: "ACTIVE"
              },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              },
              take: 1, // Get the first admin
              orderBy: {
                joinedAt: "asc" // Oldest admin (likely the founder)
              }
            }
          }
        },
        plan: {
          select: { id: true, name: true, slug: true, monthlyPrice: true }
        }
      },
      orderBy: { trialEndsAt: "asc" } // Show trials ending soonest first
    })

    // Transform the data to include adminContact at the top level
    const trialsWithContacts = subscriptions.map(sub => {
      const adminMember = sub.organization.members[0]
      return {
        id: sub.id,
        organizationId: sub.organizationId,
        planId: sub.planId,
        status: sub.status,
        createdAt: sub.createdAt,
        trialEndsAt: sub.trialEndsAt,
        organization: {
          id: sub.organization.id,
          name: sub.organization.name,
          slug: sub.organization.slug
        },
        plan: sub.plan,
        adminContact: adminMember ? {
          id: adminMember.user.id,
          name: adminMember.user.name,
          email: adminMember.user.email
        } : null
      }
    })

    return NextResponse.json(trialsWithContacts)
  } catch (error) {
    console.error("Error fetching trials:", error)
    return NextResponse.json(
      { error: "Failed to fetch trials" },
      { status: 500 }
    )
  }
}
