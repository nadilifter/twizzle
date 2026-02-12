import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  createSmsCampaign,
  getExpandedSmsCampaignRecipients,
} from "@/lib/sms-campaign-service";
import { checkUsageLimits } from "@/lib/sms-service";
import { isTwilioConfigured, calculateSegments } from "@/lib/twilio";
import type { SmsTargetType } from "@prisma/client";

const createCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  body: z.string().min(1, "Message body is required").max(1600, "Message too long"),
  classification: z
    .enum(["GENERAL", "REMINDER", "ALERT", "BILLING", "EVENT", "NEWS"])
    .optional()
    .default("GENERAL"),
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
      "ALL_FAMILIES",
    ])
    .default("ALL_MEMBERS"),
  targetProgramId: z.string().optional(),
  targetEventId: z.string().optional(),
  targetMembershipStatus: z.enum(["ACTIVE", "EXPIRED"]).optional(),
  targetProgramInstanceId: z.string().optional(),
  targetMembershipGroupIds: z.array(z.string()).optional(),
  targetFamilyIds: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
  sendImmediately: z.boolean().optional().default(false),
});

// GET /api/sms/campaigns - List SMS campaigns
export async function GET(request: NextRequest) {
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
        { body: { contains: search, mode: "insensitive" } },
      ];
    }

    const [campaigns, total] = await Promise.all([
      db.smsCampaign.findMany({
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
      db.smsCampaign.count({ where }),
    ]);

    // Get usage limits
    const limits = await checkUsageLimits(session.user.organizationId);

    return NextResponse.json({
      campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      configured: isTwilioConfigured(),
      usage: {
        used: limits.used,
        included: limits.included,
        remaining: limits.remaining,
        overageRate: limits.overageRate,
      },
    });
  } catch (error) {
    console.error("Error fetching SMS campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

// POST /api/sms/campaigns - Create a new SMS campaign
export async function POST(request: NextRequest) {
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

    const result = await createSmsCampaign({
      organizationId: session.user.organizationId,
      name: validatedData.name,
      body: validatedData.body,
      classification: validatedData.classification,
      targetType: validatedData.targetType as SmsTargetType,
      targetProgramId: validatedData.targetProgramId,
      targetEventId: validatedData.targetEventId,
      targetMembershipStatus: validatedData.targetMembershipStatus,
      targetProgramInstanceId: validatedData.targetProgramInstanceId,
      targetMembershipGroupIds: validatedData.targetMembershipGroupIds,
      targetFamilyIds: validatedData.targetFamilyIds,
      createdById: session.user.id,
      scheduledAt: validatedData.scheduledAt
        ? new Date(validatedData.scheduledAt)
        : undefined,
      sendImmediately: validatedData.sendImmediately,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      campaignId: result.campaignId,
      totalRecipients: result.totalRecipients,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error creating SMS campaign:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
