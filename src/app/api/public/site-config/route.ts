import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkApiRateLimit } from "@/lib/rate-limit";

// GET /api/public/site-config?slug=xxx
// Public endpoint - get organization ID and basic site config from slug
export async function GET(request: NextRequest) {
  const rateLimited = await checkApiRateLimit(request, "public");
  if (rateLimited) return rateLimited;

  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const config = await db.websiteConfig.findUnique({
      where: { subdomain: slug },
      select: {
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            taxRate: true,
            taxEnabled: true,
            taxPaidBy: true,
            subscription: {
              select: {
                plan: {
                  select: {
                    transactionFee: true,
                    perTransactionFee: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!config) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const plan = config.organization.subscription?.plan;

    return NextResponse.json({
      organizationId: config.organizationId,
      organizationName: config.organization.name,
      taxRate:
        config.organization.taxEnabled !== false ? Number(config.organization.taxRate ?? 0) : 0,
      taxEnabled: config.organization.taxEnabled,
      taxPaidBy: config.organization.taxPaidBy,
      transactionFee: plan ? Number(plan.transactionFee) : 0,
      perTransactionFee: plan ? Number(plan.perTransactionFee) : 0,
    });
  } catch (error) {
    console.error("Error fetching site config:", error);
    return NextResponse.json({ error: "Failed to fetch site config" }, { status: 500 });
  }
}
