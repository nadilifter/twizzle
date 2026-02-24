import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";
import { sendSingleSms, checkUsageLimits, getUsageStats } from "@/lib/sms-service";
import { isTwilioConfigured } from "@/lib/twilio";

const sendSmsSchema = z.object({
  to: z.string().min(1, "Phone number is required"),
  body: z.string().min(1, "Message body is required").max(1600, "Message too long"),
  classification: z
    .enum(["GENERAL", "REMINDER", "ALERT", "BILLING", "EVENT", "NEWS"])
    .optional()
    .default("GENERAL"),
  staffProfileId: z.string().optional(),
});

// GET /api/sms - List SMS messages
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const smsBlocked = await checkFeatureGate(session.user.organizationId, "sms");
    if (smsBlocked) return smsBlocked;

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
    const direction = searchParams.get("direction");
    const classification = searchParams.get("classification");
    const search = searchParams.get("search");
    const campaignId = searchParams.get("campaignId");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      organizationId: session.user.organizationId,
    };

    if (status) {
      where.twilioStatus = status;
    }

    if (direction) {
      where.direction = direction;
    }

    if (classification) {
      where.classification = classification;
    }

    if (campaignId) {
      where.campaignId = campaignId;
    }

    if (search) {
      where.OR = [
        { to: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
      ];
    }

    const [messages, total] = await Promise.all([
      db.smsMessage.findMany({
        where,
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.smsMessage.count({ where }),
    ]);

    // Get usage stats
    const usage = await getUsageStats(session.user.organizationId);
    const limits = await checkUsageLimits(session.user.organizationId);

    return NextResponse.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      usage,
      limits: {
        allowed: limits.allowed,
        remaining: limits.remaining,
        used: limits.used,
        included: limits.included,
        overageRate: limits.overageRate,
      },
      configured: isTwilioConfigured(),
    });
  } catch (error) {
    console.error("Error fetching SMS messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST /api/sms - Send a single SMS
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const smsBlockedPost = await checkFeatureGate(session.user.organizationId, "sms");
    if (smsBlockedPost) return smsBlockedPost;

    // Check permission
    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("communication.send")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = sendSmsSchema.parse(body);

    const result = await sendSingleSms({
      organizationId: session.user.organizationId,
      to: validatedData.to,
      body: validatedData.body,
      classification: validatedData.classification,
      staffProfileId: validatedData.staffProfileId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, errorCode: result.errorCode },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      twilioSid: result.twilioSid,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error sending SMS:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
