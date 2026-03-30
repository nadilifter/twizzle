import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/superadmin/organizations/[orgId]/payment-methods
 *
 * Get all payment methods for a specific organization (superadmin only)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();

    if (!session?.user || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: orgId } = await params;

    // Verify organization exists
    const organization = await db.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const paymentMethods = await db.organizationPaymentMethod.findMany({
      where: { organizationId: orgId },
      orderBy: [{ isActive: "desc" }, { isDefault: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        storedPaymentMethodId: true,
        shopperReference: true,
        type: true,
        brand: true,
        lastFour: true,
        expiryMonth: true,
        expiryYear: true,
        holderName: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
      },
      paymentMethods,
    });
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    return NextResponse.json({ error: "Failed to fetch payment methods" }, { status: 500 });
  }
}
