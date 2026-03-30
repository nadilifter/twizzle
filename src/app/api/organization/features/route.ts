import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getOrganizationFeatures } from "@/lib/feature-resolver";

/**
 * GET /api/organization/features
 * Returns the resolved feature toggles for the current user's organization.
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const features = await getOrganizationFeatures(organizationId);
    return NextResponse.json(features);
  } catch (error) {
    console.error("Error fetching organization features:", error);
    return NextResponse.json({ error: "Failed to fetch features" }, { status: 500 });
  }
}
