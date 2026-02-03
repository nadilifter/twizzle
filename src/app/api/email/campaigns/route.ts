import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  createEmailCampaign,
  checkEmailUsageLimits,
  getCampaignRecipients,
} from "@/lib/email-campaign-service";
import {
  renderCampaignEmail,
  getOrganizationBranding,
} from "@/lib/email-template-renderer";

const createCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  subject: z.string().min(1, "Subject is required").max(200, "Subject too long"),
  htmlBody: z.string().min(1, "Email body is required"),
  textBody: z.string().optional(),
  classification: z
    .enum(["GENERAL", "PROGRAM_UPDATE", "EVENT_UPDATE", "MEMBERSHIP", "BILLING", "NEWSLETTER"])
    .optional()
    .default("GENERAL"),
  targetScope: z.enum(["ALL", "PROGRAM", "EVENT", "FAMILY"]).default("ALL"),
  targetProgramId: z.string().optional(),
  targetEventId: z.string().optional(),
  targetMembershipStatus: z.enum(["ACTIVE", "EXPIRED"]).optional(),
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

    // Check permission
    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("communication.send")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createCampaignSchema.parse(body);

    // Validate targeting
    if (validatedData.targetScope === "PROGRAM" && !validatedData.targetProgramId) {
      return NextResponse.json(
        { error: "Program ID is required for program-targeted campaigns" },
        { status: 400 }
      );
    }

    if (validatedData.targetScope === "EVENT" && !validatedData.targetEventId) {
      return NextResponse.json(
        { error: "Event ID is required for event-targeted campaigns" },
        { status: 400 }
      );
    }

    // Get organization branding for the email template
    const branding = await getOrganizationBranding(session.user.organizationId);

    // Render the full HTML email with branding
    const { html: renderedHtml, text: renderedText } = renderCampaignEmail({
      subject: validatedData.subject,
      body: validatedData.htmlBody,
      branding,
    });

    const result = await createEmailCampaign({
      organizationId: session.user.organizationId,
      name: validatedData.name,
      subject: validatedData.subject,
      htmlBody: renderedHtml,
      textBody: validatedData.textBody || renderedText,
      classification: validatedData.classification,
      targetScope: validatedData.targetScope,
      targetProgramId: validatedData.targetProgramId,
      targetEventId: validatedData.targetEventId,
      targetMembershipStatus: validatedData.targetMembershipStatus,
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
    console.error("Error creating email campaign:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
