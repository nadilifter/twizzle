import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { verifyCronSecret, startCronMonitoring, endCronMonitoring } from "@/lib/cron-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Data Cleanup Cron
 *
 * Weekly housekeeping to prevent table bloat from expired ephemeral records:
 * 1. Delete expired PasswordResetToken rows
 * 2. Delete expired EmailVerificationCode rows
 * 3. Delete expired NextAuth VerificationToken rows
 * 4. Mark stale PENDING OrganizationInvitations as EXPIRED
 *
 * Schedule: Weekly on Sunday at 3:00 AM UTC ("0 3 * * 0")
 */
export async function GET(request: NextRequest) {
  let checkInId: string | undefined;
  try {
    if (!process.env.CRON_SECRET) {
      logger.error("CRON_SECRET is not configured");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (!verifyCronSecret(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    checkInId = startCronMonitoring("cleanup");

    const now = new Date();

    const [passwordTokens, verificationCodes, verificationTokens, expiredInvitations] =
      await Promise.all([
        db.passwordResetToken.deleteMany({
          where: { expiresAt: { lt: now } },
        }),
        db.emailVerificationCode.deleteMany({
          where: { expiresAt: { lt: now } },
        }),
        db.verificationToken.deleteMany({
          where: { expires: { lt: now } },
        }),
        db.organizationInvitation.updateMany({
          where: {
            expiresAt: { lt: now },
            status: "PENDING",
          },
          data: { status: "EXPIRED" },
        }),
      ]);

    const summary = {
      deletedPasswordResetTokens: passwordTokens.count,
      deletedVerificationCodes: verificationCodes.count,
      deletedVerificationTokens: verificationTokens.count,
      expiredInvitations: expiredInvitations.count,
    };

    logger.info("Cleanup cron completed", summary);
    await endCronMonitoring("cleanup", checkInId, "ok");
    return NextResponse.json({ success: true, summary, timestamp: now.toISOString() });
  } catch (error) {
    await endCronMonitoring("cleanup", checkInId, "error");
    logger.error("Cleanup cron failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Failed to run cleanup", timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
