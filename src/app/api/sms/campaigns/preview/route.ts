import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";
import {
  getExpandedSmsCampaignRecipients,
  renderSmsCampaignPreview,
} from "@/lib/sms-campaign-service";
import { checkUsageLimits } from "@/lib/sms-service";
import { calculateSegments } from "@/lib/twilio";
import type { SmsTargetType } from "@prisma/client";

const previewSchema = z.object({
  body: z.string().trim().min(1, "Message body is required"),
  // Expanded targeting
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

// POST /api/sms/campaigns/preview - Preview an SMS campaign
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const smsBlocked = await checkFeatureGate(session.user.organizationId, "sms");
    if (smsBlocked) return smsBlocked;

    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("communication.view")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = previewSchema.parse(body);

    // Render placeholders with example values for preview
    const previewBody = renderSmsCampaignPreview(validatedData.body);

    // Calculate segments
    const segments = calculateSegments(previewBody);

    // Get recipient count if targeting is specified
    let recipientCount = 0;
    if (validatedData.targetType) {
      const recipients = await getExpandedSmsCampaignRecipients({
        organizationId: session.user.organizationId,
        targetType: validatedData.targetType as SmsTargetType,
        targetProgramId: validatedData.targetProgramId,
        targetEventId: validatedData.targetEventId,
        targetMembershipStatus: validatedData.targetMembershipStatus,
        targetProgramInstanceId: validatedData.targetProgramInstanceId,
        targetMembershipGroupIds: validatedData.targetMembershipGroupIds,
      });
      recipientCount = recipients.length;
    }

    // Check limits
    const limits = await checkUsageLimits(session.user.organizationId, recipientCount || 1);

    return NextResponse.json({
      previewBody,
      segments,
      characterCount: previewBody.length,
      recipientCount,
      estimatedTotalSegments: segments * Math.max(recipientCount, 1),
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
    console.error("Error generating SMS preview:", error);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
