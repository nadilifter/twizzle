import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkApiRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { buildSmsConsentGrant, buildSmsConsentRevoke } from "@/lib/sms-consent";

/**
 * POST /api/account/sms-consent — grant SMS consent for the signed-in user.
 *
 * Always records source ACCOUNT_SETTINGS; the signup surfaces in Phase 3 record
 * consent inline with their own source values, so they don't go through this
 * endpoint. Grant also clears any prior opt-out (STOP) so a user can
 * re-subscribe from account settings.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkApiRateLimit(
    request,
    "account-sms-consent",
    RATE_LIMITS.sensitive
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = getClientIp(request);

    await db.user.update({
      where: { id: session.user.id },
      data: buildSmsConsentGrant("ACCOUNT_SETTINGS", ip === "unknown" ? null : ip),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error granting SMS consent:", error);
    return NextResponse.json({ error: "Failed to update SMS consent" }, { status: 500 });
  }
}

/**
 * DELETE /api/account/sms-consent — revoke SMS consent for the signed-in user.
 *
 * Clears the consent timestamp and sets smsOptOut=true so this converges with
 * the inbound STOP handler (Phase 5): either path leaves the user in the same
 * resting state, and a subsequent re-opt-in requires a fresh affirmative action.
 * The revoke source is recorded separately so UI-initiated and STOP-initiated
 * revocations remain distinguishable after the fact.
 */
export async function DELETE(request: NextRequest) {
  const rateLimitResponse = await checkApiRateLimit(
    request,
    "account-sms-consent",
    RATE_LIMITS.sensitive
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.user.update({
      where: { id: session.user.id },
      data: buildSmsConsentRevoke("ACCOUNT_SETTINGS"),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking SMS consent:", error);
    return NextResponse.json({ error: "Failed to update SMS consent" }, { status: 500 });
  }
}
