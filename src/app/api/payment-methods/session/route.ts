import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { createTokenizationSession, isAdyenConfigured } from "@/lib/adyen";
import { db } from "@/lib/db";

/**
 * POST /api/payment-methods/session
 *
 * Creates an Adyen session for adding a new payment method
 */

const sessionSchema = z.object({
  returnUrl: z.string().url("Valid return URL required"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if Adyen is configured
    if (!isAdyenConfigured()) {
      return NextResponse.json(
        { error: "Payment processing is not configured. Please contact support." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { returnUrl } = sessionSchema.parse(body);

    // Get or create the Adyen shopper reference for this org
    const subscription = await db.organizationSubscription.findUnique({
      where: { organizationId: session.user.organizationId },
      select: { adyenShopperReference: true },
    });

    // Use existing shopper reference or create a new one
    const shopperReference =
      subscription?.adyenShopperReference || `org-${session.user.organizationId}`;

    // If no shopper reference was stored, update the subscription
    if (!subscription?.adyenShopperReference && subscription) {
      await db.organizationSubscription.update({
        where: { organizationId: session.user.organizationId },
        data: { adyenShopperReference: shopperReference },
      });
    }

    // Create an Adyen session for card tokenization ($0 auth)
    const adyenSession = await createTokenizationSession(
      shopperReference,
      returnUrl,
      session.user.email || undefined,
      0
    );

    return NextResponse.json({
      sessionId: adyenSession.id,
      sessionData: adyenSession.sessionData,
      shopperReference,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }

    console.error("Error creating payment session:", error);
    return NextResponse.json({ error: "Failed to create payment session" }, { status: 500 });
  }
}
