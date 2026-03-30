import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSubdomainReserved } from "@/lib/reserved-domains";

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

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      console.error("No organizationId in session for subdomain check, user:", session.user.email);
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // Validate subdomain format (alphanumeric and hyphens only)
    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(subdomain)) {
      return NextResponse.json({ available: false, reason: "Invalid format" });
    }

    // Check against reserved domains
    const reservedCheck = await isSubdomainReserved(subdomain);
    if (reservedCheck.reserved) {
      return NextResponse.json({
        available: false,
        reason: "Reserved",
        reservedReason: reservedCheck.reason,
      });
    }

    // Check if subdomain exists
    const existing = await db.websiteConfig.findUnique({
      where: { subdomain },
      select: { organizationId: true },
    });

    if (existing) {
      // Check if this org owns the subdomain
      if (existing.organizationId === organizationId) {
        return NextResponse.json({ available: true, owned: true });
      } else {
        return NextResponse.json({ available: false, reason: "Taken" });
      }
    }

    return NextResponse.json({ available: true });
  } catch (error) {
    console.error("Error checking subdomain:", error);
    return NextResponse.json({ error: "Failed to check subdomain" }, { status: 500 });
  }
}
