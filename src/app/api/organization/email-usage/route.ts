import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getEmailUsageStats, checkEmailUsageLimits } from "@/lib/email-campaign-service";

// GET /api/organization/email-usage - Get email usage stats for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission - allow any authenticated org member to view usage
    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("communication.view") &&
      !session.user.permissions?.includes("settings.billing")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [stats, limits] = await Promise.all([
      getEmailUsageStats(session.user.organizationId),
      checkEmailUsageLimits(session.user.organizationId),
    ]);

    if (!stats) {
      return NextResponse.json({ error: "Unable to retrieve usage stats" }, { status: 500 });
    }

    return NextResponse.json({
      stats,
      limits: {
        allowed: limits.allowed,
        used: limits.used,
        included: limits.included,
        remaining: limits.remaining,
        overageRate: limits.overageRate,
      },
    });
  } catch (error) {
    console.error("Error fetching email usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch email usage" },
      { status: 500 }
    );
  }
}
