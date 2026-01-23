"use server"

import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth"

export async function getUserOrganizations() {
  const session = await getAuthSession()
  if (!session?.user?.id) {
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

  return memberships.map((m) => m.organization)
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
