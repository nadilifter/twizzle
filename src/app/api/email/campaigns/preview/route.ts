import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";
import {
  getCampaignRecipients,
  getExpandedCampaignRecipients,
  checkEmailUsageLimits,
} from "@/lib/email-campaign-service";
import { renderCampaignEmail, getOrganizationBranding } from "@/lib/email-template-renderer";
import { renderTemplatePreview } from "@/lib/notification-template-service";
import type { EmailTargetType } from "@prisma/client";

const previewSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  htmlBody: z.string().min(1, "Email body is required"),
  // Legacy targeting
  targetScope: z.enum(["ALL", "PROGRAM", "EVENT"]).optional(),
  // New expanded targeting
  targetType: z
    .enum([
      "ALL_USERS",
      "ALL_MEMBERS",
      "ALL_PROGRAM_REGISTRANTS",
      "PROGRAM_ANY_INSTANCE",
      "PROGRAM_SPECIFIC_INSTANCE",
      "MEMBERSHIP_HOLDERS",
      "SPECIFIC_USERS",
      "ALL_GUARDIANS",
    ])
    .optional(),
  targetProgramId: z.string().optional(),
  targetEventId: z.string().optional(),
  targetMembershipStatus: z.enum(["ACTIVE", "EXPIRED"]).optional(),
  targetProgramInstanceId: z.string().optional(),
  targetMembershipGroupIds: z.array(z.string()).optional(),
});

// POST /api/email/campaigns/preview - Preview an email campaign
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const emailBlocked = await checkFeatureGate(session.user.organizationId, "emailCampaigns");
    if (emailBlocked) return emailBlocked;

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

    // Render placeholders with example values for preview
    const previewSubject = renderTemplatePreview(validatedData.subject);
    const previewBody = renderTemplatePreview(validatedData.htmlBody);

    // Render the email with branding
    const { html, text } = renderCampaignEmail({
      subject: previewSubject,
      body: previewBody,
      branding,
      recipientName: "Preview User",
      unsubscribeUrl: "#unsubscribe",
    });

    // Get recipient count using new or legacy targeting
    let recipientCount = 0;
    if (validatedData.targetType) {
      const recipients = await getExpandedCampaignRecipients({
        organizationId: session.user.organizationId,
        targetType: validatedData.targetType as EmailTargetType,
        targetProgramId: validatedData.targetProgramId,
        targetEventId: validatedData.targetEventId,
        targetMembershipStatus: validatedData.targetMembershipStatus,
        targetProgramInstanceId: validatedData.targetProgramInstanceId,
        targetMembershipGroupIds: validatedData.targetMembershipGroupIds,
      });
      recipientCount = recipients.length;
    } else if (validatedData.targetScope) {
      const recipients = await getCampaignRecipients(
        session.user.organizationId,
        validatedData.targetScope,
        validatedData.targetProgramId,
        validatedData.targetEventId,
        validatedData.targetMembershipStatus
      );
      recipientCount = recipients.length;
    }

    // Check limits
    const limits = await checkEmailUsageLimits(session.user.organizationId, recipientCount);

    return NextResponse.json({
      html,
      text,
      recipientCount,
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
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
