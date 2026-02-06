import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/public/site-config?slug=xxx
// Public endpoint - get organization ID and basic site config from slug
export async function GET(request: NextRequest) {
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
          },
        },
      },
    });

    if (!config) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    return NextResponse.json({
      organizationId: config.organizationId,
      organizationName: config.organization.name,
    });
  } catch (error) {
    console.error("Error fetching site config:", error);
    return NextResponse.json(
      { error: "Failed to fetch site config" },
      { status: 500 }
    );
  }
}
