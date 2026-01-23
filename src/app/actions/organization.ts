"use server"

import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth"

export async function getUserOrganizations() {
  try {
    console.log("getUserOrganizations: Starting")
    const session = await getAuthSession()
    console.log("getUserOrganizations: Session retrieved", session ? "Session exists" : "No session", session?.user?.email)
    
    if (!session?.user?.id) {
      console.log("getUserOrganizations: Unauthorized - No user ID")
      throw new Error("Unauthorized")
    }

    const memberships = await db.organizationMember.findMany({
      where: {
        userId: session.user.id,
        status: "ACTIVE",
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
      },
    })
    
    console.log(`getUserOrganizations: Found ${memberships.length} memberships`)

    return memberships.map((m) => m.organization)
  } catch (error) {
    console.error("getUserOrganizations: Error", error)
    throw error
  }
}

export async function verifyOrganizationMembership(organizationId: string) {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return false
    }
  
    const membership = await db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
            organizationId,
            userId: session.user.id
        }
      },
    })
  
    return !!membership && membership.status === "ACTIVE"
  }
