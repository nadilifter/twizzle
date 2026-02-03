import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { z } from "zod";
import { getCampaignRecipients, checkEmailUsageLimits } from "@/lib/email-campaign-service";
import { renderCampaignEmail, getOrganizationBranding } from "@/lib/email-template-renderer";

const previewSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  htmlBody: z.string().min(1, "Email body is required"),
  targetScope: z.enum(["ALL", "PROGRAM", "EVENT", "FAMILY"]).default("ALL"),
  targetProgramId: z.string().optional(),
  targetEventId: z.string().optional(),
  targetMembershipStatus: z.enum(["ACTIVE", "EXPIRED"]).optional(),
});

// POST /api/email/campaigns/preview - Preview an email campaign
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validatedData = previewSchema.parse(body);

    // Get organization branding
    const branding = await getOrganizationBranding(session.user.organizationId);

    // Render the email
    const { html, text } = renderCampaignEmail({
      subject: validatedData.subject,
      body: validatedData.htmlBody,
      branding,
      recipientName: "Preview User",
      unsubscribeUrl: "#unsubscribe",
    });

    // Get recipient count
    const recipients = await getCampaignRecipients(
      session.user.organizationId,
      validatedData.targetScope,
      validatedData.targetProgramId,
      validatedData.targetEventId,
      validatedData.targetMembershipStatus
    );

    // Check limits
    const limits = await checkEmailUsageLimits(session.user.organizationId, recipients.length);

    return NextResponse.json({
      html,
      text,
      recipientCount: recipients.length,
      limits: {
        allowed: limits.allowed,
        remaining: limits.remaining,
        used: limits.used,
        included: limits.included,
        overageRate: limits.overageRate,
        error: limits.error,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error generating email preview:", error);
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}
