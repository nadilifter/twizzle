import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { registerAllowedOrigin, removeAllowedOrigin } from "@/lib/adyen-platform";

const DEACTIVATION_REASONS = [
  "Non-payment",
  "Requested by customer",
  "Policy violation",
  "Inactivity",
  "Other",
] as const;

const statusSchema = z.object({
  action: z.enum(["deactivate", "reactivate"]),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request body" },
        { status: 400 }
      );
    }

    const { action, reason, notes } = parsed.data;

    const organization = await db.organization.findUnique({
      where: { id },
      include: { subscription: true, websiteConfig: true },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    if (action === "deactivate") {
      if (!organization.isActive) {
        return NextResponse.json(
          { error: "Organization is already deactivated" },
          { status: 400 }
        );
      }

      if (!reason) {
        return NextResponse.json(
          { error: "A reason is required when deactivating" },
          { status: 400 }
        );
      }

      await db.$transaction(async (tx) => {
        await tx.organization.update({
          where: { id },
          data: {
            isActive: false,
            deactivatedAt: new Date(),
            deactivatedBy: session.user.id,
            deactivationReason: reason,
            deactivationNotes: notes || null,
          },
        });

        if (organization.subscription) {
          await tx.organizationSubscription.update({
            where: { id: organization.subscription.id },
            data: { status: "PAUSED" },
          });
        }

        await tx.organizationStatusLog.create({
          data: {
            organizationId: id,
            action: "DEACTIVATED",
            reason,
            notes: notes || null,
            performedBy: session.user.id,
          },
        });
      });

      if (organization.websiteConfig?.subdomain) {
        void removeAllowedOrigin(organization.websiteConfig.subdomain);
      }

      return NextResponse.json({
        success: true,
        message: "Organization deactivated successfully",
      });
    }

    if (action === "reactivate") {
      if (organization.isActive) {
        return NextResponse.json(
          { error: "Organization is already active" },
          { status: 400 }
        );
      }

      await db.$transaction(async (tx) => {
        await tx.organization.update({
          where: { id },
          data: {
            isActive: true,
            deactivatedAt: null,
            deactivatedBy: null,
            deactivationReason: null,
            deactivationNotes: null,
          },
        });

        if (
          organization.subscription &&
          organization.subscription.status === "PAUSED"
        ) {
          await tx.organizationSubscription.update({
            where: { id: organization.subscription.id },
            data: { status: "ACTIVE" },
          });
        }

        await tx.organizationStatusLog.create({
          data: {
            organizationId: id,
            action: "REACTIVATED",
            reason: reason || null,
            notes: notes || null,
            performedBy: session.user.id,
          },
        });
      });

      if (organization.websiteConfig?.subdomain) {
        void registerAllowedOrigin(organization.websiteConfig.subdomain);
      }

      return NextResponse.json({
        success: true,
        message: "Organization reactivated successfully",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error updating organization status:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update organization status" },
      { status: 500 }
    );
  }
}
