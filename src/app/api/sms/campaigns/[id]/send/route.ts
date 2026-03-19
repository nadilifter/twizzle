import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import {
  executeSmsCampaign,
  getExpandedSmsCampaignRecipients,
} from "@/lib/sms-campaign-service";
import { checkUsageLimits } from "@/lib/sms-service";

// POST /api/sms/campaigns/[id]/send - Send an SMS campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("communication.send")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Get the campaign
    const campaign = await db.smsCampaign.findUnique({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Idempotent: if already sending or completed, return success
    if (campaign.status === "SENDING" || campaign.status === "COMPLETED") {
      return NextResponse.json({
        success: true,
        message:
          campaign.status === "SENDING"
            ? "Campaign is already being sent"
            : "Campaign has already been sent",
        totalRecipients: campaign.totalRecipients ?? 0,
      });
    }

    if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
      return NextResponse.json(
        { error: `Cannot send campaign with status: ${campaign.status}` },
        { status: 400 }
      );
    }

    // Get recipients to check count
    const recipients = await getExpandedSmsCampaignRecipients({
      organizationId: campaign.organizationId,
      targetType: campaign.targetType,
      targetProgramId: campaign.targetProgramId ?? undefined,
      targetEventId: campaign.targetEventId ?? undefined,
      targetMembershipStatus: campaign.targetMembershipStatus as "ACTIVE" | "EXPIRED" | undefined,
      targetProgramInstanceId: campaign.targetProgramInstanceId ?? undefined,
      targetMembershipGroupIds: campaign.targetMembershipGroupIds,
    });

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No valid recipients found for this campaign" },
        { status: 400 }
      );
    }

    // Check usage limits
    const limits = await checkUsageLimits(session.user.organizationId, recipients.length);
    if (!limits.allowed) {
      return NextResponse.json(
        { error: limits.error || "SMS limit reached" },
        { status: 400 }
      );
    }

    // Update recipient count (in case it changed)
    const scopedDb = getScopedDb(session.user.organizationId);
    await scopedDb.smsCampaign.update({
      where: { id },
      data: { totalRecipients: recipients.length },
    });

    // Execute campaign in background
    executeSmsCampaign(id).catch((error) => {
      console.error(`Error executing SMS campaign ${id}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: "Campaign is being sent",
      totalRecipients: recipients.length,
    });
  } catch (error) {
    console.error("Error sending SMS campaign:", error);
    return NextResponse.json(
      { error: "Failed to send campaign" },
      { status: 500 }
    );
  }
}
