import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { registerAllowedOrigin } from "@/lib/adyen-platform"
import { ROLE_PERMISSIONS } from "@/lib/permissions"
import { z } from "zod"

const reactivateSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
})

// POST /api/organization/reactivate — Self-serve reactivation for customer-cancelled orgs.
// The user's session won't include the deactivated org, so we accept the org ID
// and verify membership directly.
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { organizationId } = reactivateSchema.parse(body)

    // Verify the user has an active membership with an admin role in this org
    const membership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId,
        status: "ACTIVE",
      },
      include: {
        permissions: true,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const memberPerms = membership.permissions.map((p) => p.permission)
    const permissions = memberPerms.length > 0
      ? memberPerms
      : ROLE_PERMISSIONS[membership.role?.toUpperCase() ?? ""] ?? []
    if (!permissions.includes("*") && !permissions.includes("settings.edit")) {
      return NextResponse.json(
        { error: "You don't have permission to reactivate this organization" },
        { status: 403 }
      )
    }

    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      include: { subscription: true, websiteConfig: { select: { subdomain: true } } },
    })

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    if (organization.isActive) {
      return NextResponse.json(
        { error: "Organization is already active" },
        { status: 400 }
      )
    }

    if (organization.deactivationReason !== "Requested by customer") {
      return NextResponse.json(
        { error: "This organization cannot be reactivated online. Please contact support." },
        { status: 403 }
      )
    }

    await db.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          isActive: true,
          deactivatedAt: null,
          deactivatedBy: null,
          deactivationReason: null,
          deactivationNotes: null,
          scheduledDeactivationDate: null,
          dunningWarningsSent: Prisma.DbNull,
        },
      })

      if (organization.subscription && organization.subscription.status === "CANCELLED") {
        await tx.organizationSubscription.update({
          where: { id: organization.subscription.id },
          data: {
            status: "ACTIVE",
            cancelledAt: null,
            cancelAtPeriodEnd: false,
          },
        })
      }

      await tx.organizationStatusLog.create({
        data: {
          organizationId,
          action: "REACTIVATED",
          reason: "Self-serve reactivation by customer",
          performedBy: session.user.id,
        },
      })
    })

    if (organization.websiteConfig?.subdomain) {
      void registerAllowedOrigin(organization.websiteConfig.subdomain)
    }

    return NextResponse.json({
      success: true,
      message: "Organization reactivated successfully.",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Error reactivating organization:", error)
    return NextResponse.json(
      { error: "Failed to reactivate organization" },
      { status: 500 }
    )
  }
}
