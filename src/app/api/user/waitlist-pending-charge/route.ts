// GET /api/user/waitlist-pending-charge — returns the current user's WAITLIST_PAYMENT_PENDING
// enrollment with an active (non-expired) deadline, or null. Polled by the payment banner to
// decide whether to render.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const enrollment = await db.enrollment.findFirst({
      where: {
        userId: session.user.id,
        status: "WAITLIST_PAYMENT_PENDING",
        waitlistPaymentDeadline: { not: null, gt: new Date() },
      },
      orderBy: { waitlistPaymentDeadline: "asc" },
      select: {
        id: true,
        waitlistPaymentDeadline: true,
        waitlistChargeAttempts: true,
        program: {
          select: {
            id: true,
            name: true,
            basePrice: true,
            perSessionPrice: true,
            pricingModel: true,
            organizationId: true,
          },
        },
      },
    });

    return NextResponse.json({ enrollment });
  } catch (error) {
    console.error("Error fetching waitlist pending charge:", error);
    return NextResponse.json({ error: "Failed to fetch pending charge" }, { status: 500 });
  }
}
