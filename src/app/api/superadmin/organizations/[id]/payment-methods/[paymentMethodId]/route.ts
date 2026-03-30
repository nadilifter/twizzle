import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { disableStoredPaymentMethod } from "@/lib/adyen";

/**
 * GET /api/superadmin/organizations/[orgId]/payment-methods/[paymentMethodId]
 *
 * Get a specific payment method (superadmin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentMethodId: string }> }
) {
  try {
    const session = await getAuthSession();

    if (!session?.user || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: orgId, paymentMethodId } = await params;

    const paymentMethod = await db.organizationPaymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        organizationId: orgId,
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!paymentMethod) {
      return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
    }

    return NextResponse.json(paymentMethod);
  } catch (error) {
    console.error("Error fetching payment method:", error);
    return NextResponse.json({ error: "Failed to fetch payment method" }, { status: 500 });
  }
}

/**
 * DELETE /api/superadmin/organizations/[orgId]/payment-methods/[paymentMethodId]
 *
 * Delete (disable) a payment method for an organization (superadmin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentMethodId: string }> }
) {
  try {
    const session = await getAuthSession();

    if (!session?.user || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: orgId, paymentMethodId } = await params;

    // Find the payment method
    const paymentMethod = await db.organizationPaymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        organizationId: orgId,
      },
    });

    if (!paymentMethod) {
      return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
    }

    // Disable in Adyen
    try {
      await disableStoredPaymentMethod(
        paymentMethod.shopperReference,
        paymentMethod.storedPaymentMethodId
      );
    } catch (error) {
      console.error("Failed to disable payment method in Adyen:", error);
      // Continue with local deletion even if Adyen fails
    }

    // Mark as inactive in our database
    await db.organizationPaymentMethod.update({
      where: { id: paymentMethodId },
      data: {
        isActive: false,
        isDefault: false,
      },
    });

    // If this was the default, set another as default
    if (paymentMethod.isDefault) {
      const nextDefault = await db.organizationPaymentMethod.findFirst({
        where: {
          organizationId: orgId,
          isActive: true,
        },
        orderBy: { createdAt: "asc" },
      });

      if (nextDefault) {
        await db.organizationPaymentMethod.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });

        // Update subscription with new default
        await db.organizationSubscription.updateMany({
          where: { organizationId: orgId },
          data: { adyenRecurringDetailRef: nextDefault.storedPaymentMethodId },
        });
      } else {
        // No more payment methods - clear subscription reference
        await db.organizationSubscription.updateMany({
          where: { organizationId: orgId },
          data: { adyenRecurringDetailRef: null },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment method deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting payment method:", error);
    return NextResponse.json({ error: "Failed to delete payment method" }, { status: 500 });
  }
}
