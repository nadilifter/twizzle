import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subdomain = searchParams.get("subdomain");

    if (!subdomain) {
      return NextResponse.json({ error: "Subdomain is required" }, { status: 400 });
    }

    // Validate subdomain format (alphanumeric and hyphens only)
    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(subdomain)) {
        return NextResponse.json({ available: false, reason: "Invalid format" });
    }

    // Check if subdomain exists and is not the current user's
    const existing = await db.websiteConfig.findUnique({
      where: { subdomain },
      select: { organizationId: true }
    });

    if (existing && existing.organizationId !== session.user.organizationId) {
      return NextResponse.json({ available: false, reason: "Taken" });
    }

    return NextResponse.json({ available: true });
  } catch (error) {
    console.error("Error checking subdomain:", error);
    return NextResponse.json({ error: "Failed to check subdomain" }, { status: 500 });
  }
}
