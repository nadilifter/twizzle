import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createTokenizationSession, isAdyenConfigured } from "@/lib/adyen";

/**
 * POST /api/org-signup/payment-session
 *
 * Creates an Adyen session for tokenizing a payment method during signup.
 * This is used for paid plans to collect credit card information before
 * creating the organization.
 */

const sessionSchema = z.object({
  // Temporary reference for the signup (will become org ID later)
  signupReference: z.string().min(1, "Signup reference is required"),
  // User email for the shopper
  email: z.string().email("Valid email required"),
  // Return URL after payment/tokenization
  returnUrl: z.string().url("Valid return URL required"),
});

export async function POST(request: NextRequest) {
  try {
    // Check if Adyen is configured
    if (!isAdyenConfigured()) {
      return NextResponse.json(
        {
          error:
            "Payment processing is not configured. Please contact support or add Adyen credentials to your environment.",
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { signupReference, email, returnUrl } = sessionSchema.parse(body);

    // Create a temporary shopper reference for the signup
    // This will be updated to use the actual org ID after signup
    const shopperReference = `signup-${signupReference}`;

    // Create an Adyen session for card tokenization.
    // $0 auth validates the card without charging. "enabled" mode ensures the
    // card is always stored — this is a required-payment signup, not optional.
    const session = await createTokenizationSession(
      shopperReference,
      returnUrl,
      email,
      0,
      "enabled"
    );

    return NextResponse.json({
      sessionId: session.id,
      sessionData: session.sessionData,
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
