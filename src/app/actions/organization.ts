"use server"

import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth"

export async function getUserOrganizations() {
  try {
    const session = await getAuthSession()
    
    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Super admins have access to ALL organizations (including deactivated)
    if (session.user.isSuperAdmin) {
      return await db.organization.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          isActive: true,
        },
        orderBy: {
          name: "asc",
        },
      })
    }

    // Regular users only see active organizations they're members of
    const memberships = await db.organizationMember.findMany({
      where: {
        userId: session.user.id,
        status: "ACTIVE",
        organization: { isActive: true },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            isActive: true,
          },
        },
      },
    })

    return memberships.map((m) => m.organization)
  } catch (error) {
    console.error("getUserOrganizations error:", error)
    throw error
  }
}

export async function verifyOrganizationMembership(organizationId: string) {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return false
    }
    
    // Super admins have access to all organizations
    if (session.user.isSuperAdmin) {
      return true
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

export async function getOrganizationWebsiteSubdomain(organizationId: string) {
  try {
    const websiteConfig = await db.websiteConfig.findUnique({
      where: { organizationId },
      select: { subdomain: true, isPublished: true },
    })
    
    return websiteConfig?.isPublished ? websiteConfig.subdomain : null
  } catch (error) {
    console.error("getOrganizationWebsiteSubdomain: Error", error)
    return null
  }
}
