import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { retryOutstandingInvoice } from "@/lib/subscription-billing";
import { checkApiRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/payment-methods/retry-billing
 *
 * Allows org admins to manually retry payment for a failed subscription invoice
 * after adding or updating a payment method.
 *
 * tenant-isolation-ok: SubscriptionInvoice is a platform-level model scoped by
 * session.user.organizationId via retryOutstandingInvoice().
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkApiRateLimit(
    request,
    "retry-billing",
    RATE_LIMITS.sensitive
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;

    const success = await retryOutstandingInvoice(organizationId);

    if (success) {
      return NextResponse.json({
        success: true,
        message: "Payment processed successfully. Your account is now in good standing.",
      });
    }

    return NextResponse.json({
      success: false,
      message: "Payment failed. Please try a different payment method or contact support.",
    });
  } catch (error) {
    console.error("Error retrying subscription billing:", error);
    return NextResponse.json({ error: "Failed to process payment retry" }, { status: 500 });
  }
}
