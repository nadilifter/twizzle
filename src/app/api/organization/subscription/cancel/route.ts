import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { removeAllowedOrigin } from "@/lib/adyen-platform";

// POST /api/organization/subscription/cancel — Self-serve plan cancellation
// Deactivates the organization, cancels the subscription, voids pending invoices.
export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("settings.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const organizationId = session.user.organizationId;

    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      include: { subscription: true, websiteConfig: { select: { subdomain: true } } },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (!organization.isActive) {
      return NextResponse.json({ error: "Organization is already deactivated" }, { status: 400 });
    }

    if (organization.subscription?.isLocked) {
      return NextResponse.json(
        {
          error:
            "Your subscription is locked and cannot be cancelled. Contact support for assistance.",
        },
        { status: 403 }
      );
    }

    await db.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedBy: session.user.id,
          deactivationReason: "Requested by customer",
          deactivationNotes: null,
        },
      });

      if (organization.subscription) {
        await tx.organizationSubscription.update({
          where: { id: organization.subscription.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelAtPeriodEnd: false,
          },
        });
      }

      // Void any pending subscription invoices to prevent retries by the dunning cron
      await tx.subscriptionInvoice.updateMany({
        where: {
          organizationId,
          status: { in: ["PENDING", "PROCESSING"] },
        },
        data: {
          status: "VOID",
          voidedAt: new Date(),
          voidedBy: session.user.id,
        },
      });

      await tx.organizationStatusLog.create({
        data: {
          organizationId,
          action: "DEACTIVATED",
          reason: "Requested by customer",
          performedBy: session.user.id,
        },
      });
    });

    if (organization.websiteConfig?.subdomain) {
      void removeAllowedOrigin(organization.websiteConfig.subdomain);
    }

    return NextResponse.json({
      success: true,
      message: "Your plan has been cancelled and organization deactivated.",
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}
