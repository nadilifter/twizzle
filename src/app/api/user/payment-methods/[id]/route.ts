import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { disableStoredPaymentMethod } from "@/lib/adyen";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const existing = await db.paymentMethod.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
    }

    const body = await request.json();

    if (body.isDefault === true) {
      // Unset all other defaults for this user, then set the new one
      await db.paymentMethod.updateMany({
        where: { userId: session.user.id, isDefault: true },
        data: { isDefault: false },
      });

      const updated = await db.paymentMethod.update({
        where: { id: params.id },
        data: { isDefault: true },
        select: {
          id: true,
          type: true,
          brand: true,
          last4: true,
          expiry: true,
          isDefault: true,
          createdAt: true,
        },
      });

      return NextResponse.json({ paymentMethod: updated });
    }

    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  } catch (error) {
    console.error(
      "Update user payment method error:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: "Failed to update payment method" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const existing = await db.paymentMethod.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
    }

    // Disable in Adyen first
    if (existing.adyenTokenId && existing.shopperReference) {
      try {
        await disableStoredPaymentMethod(existing.shopperReference, existing.adyenTokenId);
      } catch (adyenError) {
        console.error(
          "Failed to disable payment method in Adyen (proceeding with local delete):",
          adyenError instanceof Error ? adyenError.message : adyenError
        );
      }
    }

    await db.paymentMethod.delete({ where: { id: params.id } });

    // If this was the default, promote the next one
    if (existing.isDefault) {
      const nextMethod = await db.paymentMethod.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
      });
      if (nextMethod) {
        await db.paymentMethod.update({
          where: { id: nextMethod.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "Delete user payment method error:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: "Failed to delete payment method" }, { status: 500 });
  }
}
