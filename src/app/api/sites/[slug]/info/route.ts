import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/sites/[slug]/info
 *
 * Get basic public information about a marketing site's organization.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const config = await db.websiteConfig.findUnique({
      where: { subdomain: slug },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!config || !config.isPublished) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    return NextResponse.json({
      subdomain: slug,
      organizationId: config.organizationId,
      organizationName: config.organization.name,
      primaryColor: config.primaryColor,
    });
  } catch (error) {
    console.error("Site info error:", error);
    return NextResponse.json({ error: "Failed to get site info" }, { status: 500 });
  }
}
