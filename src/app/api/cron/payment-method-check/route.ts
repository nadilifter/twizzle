import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdyenConfigured } from "@/lib/adyen";
import { syncPaymentMethodsFromAdyen } from "@/lib/payment-method-sync";
import { isPaymentMethodExpired, isPaymentMethodExpiringSoon } from "@/lib/payment-utils";
import { sendTemplatedEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

function verifyCronSecret(authHeader: string | null): boolean {
  if (!CRON_SECRET || !authHeader) return false;
  const expected = `Bearer ${CRON_SECRET}`;
  if (authHeader.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

/**
 * Payment Method Check Cron
 *
 * Weekly proactive check for expiring payment methods:
 * 1. Sync each active org's payment methods with Adyen
 * 2. Identify orgs whose only/default payment method expires within 30 days
 * 3. Send warning email to org admins
 *
 * Schedule: Weekly on Monday at 2:00 PM UTC ("0 14 * * 1")
 */
export async function GET(request: NextRequest) {
  try {
    if (!CRON_SECRET) {
      logger.error("CRON_SECRET is not configured");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (!verifyCronSecret(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdyenConfigured()) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Adyen not configured",
        timestamp: new Date().toISOString(),
      });
    }

    const activeOrgs = await db.organization.findMany({
      where: {
        isActive: true,
        subscription: { status: { in: ["ACTIVE", "TRIALING"] } },
      },
      select: { id: true, name: true },
    });

    const summary = {
      orgsChecked: 0,
      orgsSynced: 0,
      warningsSent: 0,
      errors: [] as string[],
    };

    for (const org of activeOrgs) {
      summary.orgsChecked++;

      try {
        await syncPaymentMethodsFromAdyen(org.id);
        summary.orgsSynced++;
      } catch (err) {
        logger.warn("Failed to sync payment methods for org", {
          organizationId: org.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      try {
        const activeMethods = await db.organizationPaymentMethod.findMany({
          where: { organizationId: org.id, isActive: true },
          select: {
            expiryMonth: true,
            expiryYear: true,
            lastFour: true,
            brand: true,
            isDefault: true,
          },
        });

        if (activeMethods.length === 0) continue;

        const expiringMethods = activeMethods.filter((pm) => isPaymentMethodExpiringSoon(pm));

        if (expiringMethods.length === 0) continue;

        const hasNonExpiringMethod = activeMethods.some(
          (pm) => !isPaymentMethodExpired(pm) && !isPaymentMethodExpiringSoon(pm)
        );

        if (hasNonExpiringMethod) continue;

        const adminEmails = await db.organizationMember.findMany({
          where: { organizationId: org.id, role: "ADMIN", status: "ACTIVE" },
          include: { user: { select: { email: true } } },
        });
        const emails = adminEmails.map((m) => m.user.email).filter(Boolean) as string[];
        if (emails.length === 0) continue;

        const card = expiringMethods.find((m) => m.isDefault) ?? expiringMethods[0];
        const expiryDate = `${card.expiryMonth}/${card.expiryYear}`;

        await sendTemplatedEmail("payment-method-expiring", emails, {
          organizationName: org.name,
          cardBrand: card.brand ?? "Card",
          cardLast4: card.lastFour ?? "****",
          expiryDate,
        });

        summary.warningsSent++;
      } catch (err) {
        const msg = `Org ${org.id}: ${err instanceof Error ? err.message : String(err)}`;
        summary.errors.push(msg);
        logger.error("Payment method check failed for org", { organizationId: org.id, error: msg });
      }
    }

    logger.info("Payment method check cron completed", summary);
    return NextResponse.json({ success: true, summary, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error("Payment method check cron failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check payment methods",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
