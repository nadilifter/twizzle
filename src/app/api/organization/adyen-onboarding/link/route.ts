import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateOnboardingLink, createBusinessLine } from "@/lib/adyen-platform";
import { getWebhookBaseUrl } from "@/lib/webhooks";
import { getSubdomainUrl } from "@/lib/env-domains";

/**
 * POST /api/organization/adyen-onboarding/link
 * Generates a hosted onboarding link for the current organization.
 * Redirects back to the onboarding dashboard page after completion.
 */
export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permissions = session.user.permissions || [];
    if (!permissions.includes("*") && !permissions.includes("financials.create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const account = await db.adyenPlatformAccount.findUnique({
      where: { organizationId: session.user.organizationId, accountStatus: "ACTIVE" },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Onboarding not started. Initiate onboarding first." },
        { status: 400 }
      );
    }

    if (!account.legalEntityId) {
      return NextResponse.json({ error: "Legal entity not created" }, { status: 400 });
    }

    // Ensure a business line is recorded in the DB. After a DB reset the account record
    // can have a stale or null businessLineId that doesn't match the live Adyen entity.
    // We always attempt creation; a 422 "duplicate" tells us the real ID to record.
    {
      const org = await db.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { slug: true, websiteConfig: { select: { subdomain: true } } },
      });
      const subdomain = org?.websiteConfig?.subdomain || org?.slug || "app";
      const webAddress = getSubdomainUrl(subdomain);
      try {
        const businessLine = await createBusinessLine({
          legalEntityId: account.legalEntityId,
          industryCode: "4431A",
          service: "paymentProcessing",
          salesChannels: ["eCommerce"],
          webData: [{ webAddress }],
        });
        await db.adyenPlatformAccount.update({
          where: { id: account.id },
          data: { businessLineId: businessLine.id },
        });
      } catch (blError: any) {
        // 422 with a duplicate field means a business line already exists — extract its ID.
        const existingId = (() => {
          try {
            const body = JSON.parse(blError.responseBody ?? "{}");
            const dup = (body.invalidFields ?? []).find(
              (f: any) => f.name === "ACQUIRING_BUSINESS_LINE" && f.message?.includes("duplicate")
            );
            return dup?.value ?? null;
          } catch {
            return null;
          }
        })();

        if (blError.statusCode === 422 && existingId) {
          await db.adyenPlatformAccount.update({
            where: { id: account.id },
            data: { businessLineId: existingId },
          });
        } else {
          console.error("Failed to create/recover business line before onboarding link", {
            legalEntityId: account.legalEntityId,
            status: blError.statusCode,
            body: blError.responseBody,
          });
          // Non-fatal: proceed and let Adyen's onboarding page handle it.
        }
      }
    }

    const baseUrl = getWebhookBaseUrl();
    const redirectUrl = `${baseUrl}/dashboard/financials/onboarding`;

    const link = await generateOnboardingLink(account.legalEntityId, redirectUrl);

    return NextResponse.json({ url: link.url });
  } catch (error: any) {
    console.error("Failed to generate onboarding link:", error);
    return NextResponse.json({ error: "Failed to generate onboarding link" }, { status: 500 });
  }
}
