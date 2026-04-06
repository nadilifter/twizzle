import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        taxEnabled: true,
        taxRate: true,
        taxPaidBy: true,
        subscription: {
          select: {
            plan: {
              select: {
                name: true,
                transactionFee: true,
                perTransactionFee: true,
              },
            },
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const plan = organization.subscription?.plan;

    return NextResponse.json({
      taxEnabled: organization.taxEnabled,
      taxRate: organization.taxRate ? Number(organization.taxRate) : 0,
      taxPaidBy: organization.taxPaidBy,
      plan: plan
        ? {
            name: plan.name,
            transactionFee: Number(plan.transactionFee),
            perTransactionFee: Number(plan.perTransactionFee),
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to fetch tax and fee settings:", error);
    return NextResponse.json({ error: "Failed to fetch tax and fee settings" }, { status: 500 });
  }
}

const VALID_FEE_PAYERS = ["CUSTOMER", "ORGANIZATION"] as const;

export async function PATCH(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    if (
      session.user.role !== "OWNER" &&
      session.user.role !== "ADMIN" &&
      !session.user.isSuperAdmin
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await request.json();
    const { taxEnabled, taxRate, taxPaidBy } = data;

    if (taxEnabled !== undefined && typeof taxEnabled !== "boolean") {
      return NextResponse.json({ error: "taxEnabled must be a boolean" }, { status: 400 });
    }

    if (
      taxRate !== undefined &&
      (typeof taxRate !== "number" || !isFinite(taxRate) || taxRate < 0 || taxRate > 1)
    ) {
      return NextResponse.json(
        { error: "Tax rate must be a finite number between 0 and 1" },
        { status: 400 }
      );
    }

    if (taxPaidBy !== undefined && !VALID_FEE_PAYERS.includes(taxPaidBy)) {
      return NextResponse.json(
        { error: "taxPaidBy must be CUSTOMER or ORGANIZATION" },
        { status: 400 }
      );
    }

    const organization = await db.organization.update({
      where: { id: organizationId },
      data: {
        ...(taxEnabled !== undefined && { taxEnabled }),
        ...(taxRate !== undefined && { taxRate }),
        ...(taxPaidBy !== undefined && { taxPaidBy }),
      },
      select: {
        taxEnabled: true,
        taxRate: true,
        taxPaidBy: true,
      },
    });

    return NextResponse.json({
      taxEnabled: organization.taxEnabled,
      taxRate: organization.taxRate ? Number(organization.taxRate) : 0,
      taxPaidBy: organization.taxPaidBy,
    });
  } catch (error) {
    console.error("Failed to update tax and fee settings:", error);
    return NextResponse.json({ error: "Failed to update tax and fee settings" }, { status: 500 });
  }
}
