import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { z } from "zod";
import { getExpandedCampaignRecipients } from "@/lib/email-campaign-service";
import type { EmailTargetType } from "@prisma/client";

const recipientsQuerySchema = z.object({
  targetType: z.enum([
    "ALL_USERS",
    "ALL_MEMBERS",
    "ALL_PROGRAM_REGISTRANTS",
    "PROGRAM_ANY_INSTANCE",
    "PROGRAM_SPECIFIC_INSTANCE",
    "MEMBERSHIP_HOLDERS",
    "SPECIFIC_USERS",
    "ALL_GUARDIANS",
  ]),
  targetProgramId: z.string().optional(),
  targetEventId: z.string().optional(),
  targetMembershipStatus: z.enum(["ACTIVE", "EXPIRED"]).optional(),
  targetProgramInstanceId: z.string().optional(),
  targetMembershipGroupIds: z.array(z.string()).optional(),
  targetUserIds: z.array(z.string()).optional(),
});

/**
 * POST /api/email/campaigns/recipients
 *
 * Returns the count and optionally the list of recipients
 * for a given targeting configuration. Used by the compose dialog
 * to show "Will be sent to X recipients" in real time.
 */
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
    const validatedData = recipientsQuerySchema.parse(body);

    const recipients = await getExpandedCampaignRecipients({
      organizationId: session.user.organizationId,
      targetType: validatedData.targetType as EmailTargetType,
      targetProgramId: validatedData.targetProgramId,
      targetEventId: validatedData.targetEventId,
      targetMembershipStatus: validatedData.targetMembershipStatus,
      targetProgramInstanceId: validatedData.targetProgramInstanceId,
      targetMembershipGroupIds: validatedData.targetMembershipGroupIds,
      targetUserIds: validatedData.targetUserIds,
    });

    return NextResponse.json({
      count: recipients.length,
      recipients: recipients.slice(0, 50).map((r) => ({
        email: r.email,
        name: r.name,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error fetching campaign recipients:", error);
    return NextResponse.json({ error: "Failed to fetch recipients" }, { status: 500 });
  }
}
