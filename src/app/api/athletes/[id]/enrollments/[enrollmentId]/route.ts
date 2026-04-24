import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { promoteFromWaitlist } from "@/lib/waitlist-promotion";

/**
 * DELETE /api/athletes/[id]/enrollments/[enrollmentId]
 *
 * Athlete-facing cancel. The authenticated user must be a guardian of the athlete.
 * Cancels ACTIVE, WAITLISTED, or WAITLIST_PAYMENT_PENDING enrollments only.
 * Triggers waitlist promotion if the enrollment was occupying a spot.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id: athleteId, enrollmentId } = await params;
    const userId =
      session.user.isSuperAdmin && session.user.viewingAsUserId
        ? session.user.viewingAsUserId
        : session.user.id;

    const guardianLink = await db.athleteGuardian.findFirst({
      where: { athleteId, userId },
    });
    if (!guardianLink) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const enrollment = await db.enrollment.findFirst({
      where: {
        id: enrollmentId,
        athleteId,
        status: { in: ["ACTIVE", "WAITLISTED", "WAITLIST_PAYMENT_PENDING"] },
      },
      select: { id: true, status: true, programId: true },
    });
    if (!enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found or already cancelled" },
        { status: 404 }
      );
    }

    const wasOccupyingSpot =
      enrollment.status === "ACTIVE" || enrollment.status === "WAITLIST_PAYMENT_PENDING";

    await db.$transaction(async (tx) => {
      await tx.enrollment.update({
        where: { id: enrollmentId },
        data: { status: "CANCELLED", waitlistPaymentDeadline: null },
      });
      if (wasOccupyingSpot) {
        await tx.recurringCharge.updateMany({
          where: { enrollmentId, status: { in: ["ACTIVE", "PAUSED", "FAILED"] } },
          data: { status: "CANCELLED" },
        });
      }
    });

    if (wasOccupyingSpot) {
      promoteFromWaitlist(enrollment.programId).catch((err) =>
        console.error("Waitlist promotion failed after athlete cancellation:", err)
      );
    }

    // TODO: if the enrollment had a successful payment (ACTIVE from waitlist promotion),
    // issue a refund via Adyen for the charged amount. Need to look up the invoice
    // created during promotion and reverse the transaction.

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling enrollment:", error);
    return NextResponse.json({ error: "Failed to cancel enrollment" }, { status: 500 });
  }
}
