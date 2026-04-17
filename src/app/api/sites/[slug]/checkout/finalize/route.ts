import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getAuthSession } from "@/lib/auth";
import { sendCheckoutSetupEmailIfNeeded } from "@/lib/checkout-user-provisioning";

/**
 * POST /api/sites/[slug]/checkout/finalize
 *
 * Thin status-check endpoint called fire-and-forget from the checkout page
 * after Adyen's onPaymentCompleted fires. Returns the current invoice state
 * so the client has it, but does no processing — the webhook owns everything.
 */
export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { invoiceId } = await request.json();

    if (!invoiceId || typeof invoiceId !== "string") {
      return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
    }

    const config = await db.websiteConfig.findUnique({
      where: { subdomain: params.slug },
      select: { organizationId: true },
    });
    if (!config) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId, organizationId: config.organizationId },
      select: { id: true, status: true, postPaymentProcessed: true, userId: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    //
    if (invoice.userId) {
      sendCheckoutSetupEmailIfNeeded(invoice.userId).catch((err) =>
        logger.error("Finalize: failed to send account setup email", {
          err,
          userId: invoice.userId,
        })
      );
    }

    // Ownership check: authenticated users must own this invoice.
    // Guest invoices (userId = null) are exempt.
    const authSession = await getAuthSession();
    if (authSession?.user?.id && invoice.userId && authSession.user.id !== invoice.userId) {
      logger.warn("Finalize: unauthorized status check", {
        callerId: authSession.user.id,
        invoiceUserId: invoice.userId,
        invoiceId,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      status: invoice.status,
      postPaymentProcessed: invoice.postPaymentProcessed,
    });
  } catch (error) {
    console.error("Finalize endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
