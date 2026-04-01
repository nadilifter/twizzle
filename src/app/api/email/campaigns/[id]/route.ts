import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { z } from "zod";
import { cancelEmailCampaign } from "@/lib/email-campaign-service";
import { renderCampaignEmail, getOrganizationBranding } from "@/lib/email-template-renderer";

const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().min(1).max(200).optional(),
  htmlBody: z.string().min(1).optional(),
  textBody: z.string().optional(),
  classification: z
    .enum(["GENERAL", "PROGRAM_UPDATE", "EVENT_UPDATE", "MEMBERSHIP", "BILLING", "NEWSLETTER"])
    .optional(),
  targetScope: z.enum(["ALL", "PROGRAM", "EVENT"]).optional(),
  targetProgramId: z.string().nullable().optional(),
  targetEventId: z.string().nullable().optional(),
  targetMembershipStatus: z.enum(["ACTIVE", "EXPIRED"]).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  status: z.enum(["CANCELLED"]).optional(), // Only allow cancel via PATCH
});

// GET /api/email/campaigns/[id] - Get a single campaign with messages
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("communication.view")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const campaign = await db.emailCampaign.findUnique({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 100, // Limit messages for performance
          select: {
            id: true,
            to: true,
            status: true,
            sentAt: true,
            deliveredAt: true,
            openedAt: true,
            clickedAt: true,
            bouncedAt: true,
            errorMessage: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Calculate additional stats
    const stats = {
      totalRecipients: campaign.totalRecipients,
      sentCount: campaign.sentCount,
      deliveredCount: campaign.deliveredCount,
      openedCount: campaign.openedCount,
      clickedCount: campaign.clickedCount,
      bouncedCount: campaign.bouncedCount,
      complainedCount: campaign.complainedCount,
      failedCount: campaign.failedCount,
      openRate:
        campaign.deliveredCount > 0
          ? ((campaign.openedCount / campaign.deliveredCount) * 100).toFixed(1)
          : "0",
      clickRate:
        campaign.deliveredCount > 0
          ? ((campaign.clickedCount / campaign.deliveredCount) * 100).toFixed(1)
          : "0",
      bounceRate:
        campaign.sentCount > 0
          ? ((campaign.bouncedCount / campaign.sentCount) * 100).toFixed(1)
          : "0",
    };

    return NextResponse.json({
      campaign,
      stats,
    });
  } catch (error) {
    console.error("Error fetching email campaign:", error);
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
}

// PATCH /api/email/campaigns/[id] - Update or cancel a campaign
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const body = await request.json();
    const validatedData = updateCampaignSchema.parse(body);

    // Get existing campaign
    const campaign = await db.emailCampaign.findUnique({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Only allow updates to DRAFT or SCHEDULED campaigns
    if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
      // Allow cancel operation on any non-completed campaign
      if (validatedData.status === "CANCELLED") {
        const cancelled = await cancelEmailCampaign(id);
        if (!cancelled) {
          return NextResponse.json({ error: "Cannot cancel this campaign" }, { status: 400 });
        }
        return NextResponse.json({ success: true, message: "Campaign cancelled" });
      }

      return NextResponse.json(
        { error: "Cannot update a campaign that has already been sent" },
        { status: 400 }
      );
    }

    // Handle cancel
    if (validatedData.status === "CANCELLED") {
      const cancelled = await cancelEmailCampaign(id);
      if (!cancelled) {
        return NextResponse.json({ error: "Cannot cancel this campaign" }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: "Campaign cancelled" });
    }

    // If htmlBody is being updated, re-render with branding
    let updateData: any = { ...validatedData };

    if (validatedData.htmlBody) {
      const branding = await getOrganizationBranding(session.user.organizationId);
      const { html: renderedHtml, text: renderedText } = renderCampaignEmail({
        subject: validatedData.subject || campaign.subject,
        body: validatedData.htmlBody,
        branding,
      });
      updateData.rawBody = validatedData.htmlBody;
      updateData.htmlBody = renderedHtml;
      if (!validatedData.textBody) {
        updateData.textBody = renderedText;
      }
    }

    const scopedDb = getScopedDb(session.user.organizationId);
    const updatedCampaign = await scopedDb.emailCampaign.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error updating email campaign:", error);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

// DELETE /api/email/campaigns/[id] - Delete a draft campaign
export async function DELETE(
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

    // Get existing campaign
    const campaign = await db.emailCampaign.findUnique({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Only allow deletion of DRAFT campaigns
    if (campaign.status !== "DRAFT") {
      return NextResponse.json({ error: "Can only delete draft campaigns" }, { status: 400 });
    }

    const scopedDb = getScopedDb(session.user.organizationId);
    await scopedDb.emailCampaign.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Campaign deleted" });
  } catch (error) {
    console.error("Error deleting email campaign:", error);
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
}
