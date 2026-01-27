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

    // Super admins have access to ALL organizations
    if (session.user.isSuperAdmin) {
      console.log("getUserOrganizations: Super admin - returning all organizations")
      const allOrganizations = await db.organization.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
        },
        orderBy: {
          name: "asc",
        },
      })
      console.log(`getUserOrganizations: Found ${allOrganizations.length} organizations for super admin`)
      return allOrganizations
    }

    // Regular users only see organizations they're members of
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
