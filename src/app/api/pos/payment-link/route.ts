import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { createPaymentLink, getPaymentLink } from "@/lib/adyen";
import { z } from "zod";

const createPaymentLinkSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().length(3).default("USD"),
  reference: z.string().min(1, "Reference is required"),
  description: z.string().optional(),
});

// POST /api/pos/payment-link - Create a payment link
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const posBlocked = await checkFeatureGate(session.user.organizationId, "pointOfSale");
    if (posBlocked) return posBlocked;

    const body = await request.json();
    const validatedData = createPaymentLinkSchema.parse(body);

    // Create payment link via Adyen
    const paymentLink = await createPaymentLink(
      validatedData.amount,
      validatedData.currency,
      validatedData.reference,
      validatedData.description
    );

    return NextResponse.json({
      id: paymentLink.id,
      url: paymentLink.url,
      reference: paymentLink.reference,
      status: paymentLink.status,
      expiresAt: paymentLink.expiresAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating payment link:", error);
    return NextResponse.json(
      { error: "Failed to create payment link" },
      { status: 500 }
    );
  }
}

// GET /api/pos/payment-link?id=xxx - Get payment link status
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get("id");

    if (!linkId) {
      return NextResponse.json({ error: "Payment link ID is required" }, { status: 400 });
    }

    const paymentLink = await getPaymentLink(linkId);

    return NextResponse.json({
      id: paymentLink.id,
      url: paymentLink.url,
      reference: paymentLink.reference,
      status: paymentLink.status,
      expiresAt: paymentLink.expiresAt,
    });
  } catch (error) {
    console.error("Error getting payment link:", error);
    return NextResponse.json(
      { error: "Failed to get payment link status" },
      { status: 500 }
    );
  }
}
