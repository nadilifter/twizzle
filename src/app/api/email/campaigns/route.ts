import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";
import {
  createEmailCampaign,
  checkEmailUsageLimits,
  getExpandedCampaignRecipients,
} from "@/lib/email-campaign-service";
import {
  renderCampaignEmail,
  getOrganizationBranding,
} from "@/lib/email-template-renderer";
import type { EmailTargetType } from "@prisma/client";

const createCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  subject: z.string().min(1, "Subject is required").max(200, "Subject too long"),
  htmlBody: z.string().min(1, "Email body is required"),
  textBody: z.string().optional(),
  classification: z
    .enum(["GENERAL", "PROGRAM_UPDATE", "EVENT_UPDATE", "MEMBERSHIP", "BILLING", "NEWSLETTER"])
    .optional()
    .default("GENERAL"),
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
      "ALL_FAMILIES",
    ])
    .default("ALL_MEMBERS"),
  // Legacy targeting (backward compat)
  targetScope: z.enum(["ALL", "PROGRAM", "EVENT", "FAMILY"]).optional(),
  targetProgramId: z.string().optional(),
  targetEventId: z.string().optional(),
  targetMembershipStatus: z.enum(["ACTIVE", "EXPIRED"]).optional(),
  // New targeting fields
  targetProgramInstanceId: z.string().optional(),
  targetMembershipGroupIds: z.array(z.string()).optional(),
  targetFamilyIds: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
  sendImmediately: z.boolean().optional().default(false),
});

// GET /api/email/campaigns - List email campaigns
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      organizationId: session.user.organizationId,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
      ];
    }

    const [campaigns, total] = await Promise.all([
      db.emailCampaign.findMany({
        where,
        include: {
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.emailCampaign.count({ where }),
    ]);

    // Get usage limits
    const limits = await checkEmailUsageLimits(session.user.organizationId);

    return NextResponse.json({
      campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      usage: {
        used: limits.used,
        included: limits.included,
        remaining: limits.remaining,
        overageRate: limits.overageRate,
      },
    });
  } catch (error) {
    console.error("Error fetching email campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

// POST /api/email/campaigns - Create a new email campaign
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const emailBlockedPost = await checkFeatureGate(session.user.organizationId, "emailCampaigns");
    if (emailBlockedPost) return emailBlockedPost;

    // Check permission
    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("communication.send")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createCampaignSchema.parse(body);

    // Validate targeting requirements
    if (
      (validatedData.targetType === "PROGRAM_ANY_INSTANCE" ||
        validatedData.targetType === "PROGRAM_SPECIFIC_INSTANCE") &&
      !validatedData.targetProgramId
    ) {
      return NextResponse.json(
        { error: "Program ID is required for program-targeted campaigns" },
        { status: 400 }
      );
    }

    if (
      validatedData.targetType === "PROGRAM_SPECIFIC_INSTANCE" &&
      !validatedData.targetProgramInstanceId
    ) {
      return NextResponse.json(
        { error: "Program instance ID is required for instance-specific campaigns" },
        { status: 400 }
      );
    }

    if (
      validatedData.targetType === "MEMBERSHIP_HOLDERS" &&
      (!validatedData.targetMembershipGroupIds || validatedData.targetMembershipGroupIds.length === 0)
    ) {
      return NextResponse.json(
        { error: "At least one membership group is required for membership-targeted campaigns" },
        { status: 400 }
      );
    }

    if (
      validatedData.targetType === "SPECIFIC_USERS" &&
      (!validatedData.targetFamilyIds || validatedData.targetFamilyIds.length === 0)
    ) {
      return NextResponse.json(
        { error: "At least one family must be selected for user-specific campaigns" },
        { status: 400 }
      );
    }

    // Get organization branding for the email template
    const branding = await getOrganizationBranding(session.user.organizationId);

    // Render the full HTML email with branding (placeholders stay as {{key}} for per-recipient rendering)
    const { html: renderedHtml, text: renderedText } = renderCampaignEmail({
      subject: validatedData.subject,
      body: validatedData.htmlBody,
      branding,
    });

    // Map targetType to legacy targetScope for backward compat
    const targetScopeMap: Record<string, string> = {
      ALL_USERS: "ALL",
      ALL_MEMBERS: "ALL",
      ALL_PROGRAM_REGISTRANTS: "ALL",
      PROGRAM_ANY_INSTANCE: "PROGRAM",
      PROGRAM_SPECIFIC_INSTANCE: "PROGRAM",
      MEMBERSHIP_HOLDERS: "ALL",
      SPECIFIC_USERS: "FAMILY",
      ALL_FAMILIES: "FAMILY",
    };

    // Get recipients using expanded targeting
    const recipients = await getExpandedCampaignRecipients({
      organizationId: session.user.organizationId,
      targetType: validatedData.targetType as EmailTargetType,
      targetProgramId: validatedData.targetProgramId,
      targetEventId: validatedData.targetEventId,
      targetMembershipStatus: validatedData.targetMembershipStatus,
      targetProgramInstanceId: validatedData.targetProgramInstanceId,
      targetMembershipGroupIds: validatedData.targetMembershipGroupIds,
      targetFamilyIds: validatedData.targetFamilyIds,
    });

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

    // Create campaign with new targeting fields
    const campaign = await db.emailCampaign.create({
      data: {
        organizationId: session.user.organizationId,
        name: validatedData.name,
        subject: validatedData.subject,
        htmlBody: renderedHtml,
        textBody: validatedData.textBody || renderedText,
        classification: validatedData.classification,
        targetScope: (targetScopeMap[validatedData.targetType] || "ALL") as any,
        targetType: validatedData.targetType as EmailTargetType,
        targetProgramId: validatedData.targetProgramId,
        targetEventId: validatedData.targetEventId,
        targetMembershipStatus: validatedData.targetMembershipStatus,
        targetProgramInstanceId: validatedData.targetProgramInstanceId,
        targetMembershipGroupIds: validatedData.targetMembershipGroupIds || [],
        targetFamilyIds: validatedData.targetFamilyIds || [],
        totalRecipients: recipients.length,
        createdById: session.user.id,
        status: validatedData.scheduledAt ? "SCHEDULED" : "DRAFT",
        scheduledAt: validatedData.scheduledAt
          ? new Date(validatedData.scheduledAt)
          : undefined,
      },
    });

    // If sendImmediately, start sending
    if (validatedData.sendImmediately && !validatedData.scheduledAt) {
      // Import dynamically to avoid circular deps
      const { executeEmailCampaign } = await import("@/lib/email-campaign-service");
      executeEmailCampaign(campaign.id).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      totalRecipients: recipients.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error creating email campaign:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
