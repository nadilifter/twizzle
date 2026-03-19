import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { executeEmailCampaign, checkEmailUsageLimits, getCampaignRecipients } from "@/lib/email-campaign-service";

// POST /api/email/campaigns/[id]/send - Send a campaign
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
    const campaign = await db.emailCampaign.findUnique({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Idempotent: if already sending or completed, return success (e.g. create + sendImmediately race)
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
    const recipients = await getCampaignRecipients(
      campaign.organizationId,
      campaign.targetScope,
      campaign.targetProgramId ?? undefined,
      campaign.targetEventId ?? undefined,
      campaign.targetMembershipStatus as "ACTIVE" | "EXPIRED" | undefined
    );

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No valid recipients found for this campaign" },
        { status: 400 }
      );
    }

    // Check usage limits
    const limits = await checkEmailUsageLimits(session.user.organizationId, recipients.length);
    if (!limits.allowed) {
      return NextResponse.json(
        { error: limits.error || "Email limit reached" },
        { status: 400 }
      );
    }

    // Update recipient count (in case it changed)
    const scopedDb = getScopedDb(session.user.organizationId);
    await scopedDb.emailCampaign.update({
      where: { id },
      data: { totalRecipients: recipients.length },
    });

    // Execute campaign in background
    executeEmailCampaign(id).catch((error) => {
      console.error(`Error executing email campaign ${id}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: "Campaign is being sent",
      totalRecipients: recipients.length,
    });
  } catch (error) {
    console.error("Error sending email campaign:", error);
    return NextResponse.json(
      { error: "Failed to send campaign" },
      { status: 500 }
    );
  }
}
