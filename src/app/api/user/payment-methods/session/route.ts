import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { createTokenizationSession, isAdyenConfigured } from "@/lib/adyen";

/**
 * POST /api/user/payment-methods/session
 *
 * Creates an Adyen tokenization session for a guardian to add or update
 * their personal payment method (used for recurring tenant charges).
 * The existing adyen-recurring webhook already processes user-* tokens.
 */

const sessionSchema = z.object({
  returnUrl: z.string().url("Valid return URL required"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdyenConfigured()) {
      return NextResponse.json({ error: "Payment processing is not configured." }, { status: 503 });
    }

    const body = await request.json();
    const { returnUrl } = sessionSchema.parse(body);

    const shopperReference = `user-${session.user.id}`;

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
    console.error("Error creating user payment session:", error);
    return NextResponse.json({ error: "Failed to create payment session" }, { status: 500 });
  }
}
