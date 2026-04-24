import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { syncUserPaymentMethodsFromAdyen } from "@/lib/payment-method-sync";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Reconcile with Adyen before reading local records so tokens created
    // via the dialog show up even when the RECURRING_CONTRACT webhook is
    // delayed or not yet delivered (common in local dev without a tunnel).
    try {
      await syncUserPaymentMethodsFromAdyen(session.user.id);
    } catch (syncError) {
      console.error(
        "Adyen user payment method sync failed:",
        syncError instanceof Error ? syncError.message : syncError
      );
    }

    const paymentMethods = await db.paymentMethod.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        type: true,
        brand: true,
        last4: true,
        expiry: true,
        isDefault: true,
        createdAt: true,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ paymentMethods });
  } catch (error) {
    console.error(
      "Fetch user payment methods error:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: "Failed to fetch payment methods" }, { status: 500 });
  }
}
