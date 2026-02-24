import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  getNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  executeNotification,
} from "@/lib/notification-service";

const updateRuleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  timingValue: z.number().min(0).optional(),
  timingUnit: z.enum(["MINUTES", "HOURS", "DAYS", "WEEKS", "MONTHS"]).optional(),
  timingDirection: z.enum(["BEFORE", "AFTER", "AT"]).optional(),
  actionType: z.enum(["ANNOUNCEMENT", "EMAIL", "SMS"]).optional(),
  isActive: z.boolean().optional(),
  template: z.object({
    subject: z.string().optional(),
    body: z.string().optional(),
    smsBody: z.string().optional(),
  }).optional(),
  recipientConfig: z.object({
    recipientType: z.enum([
      "ALL_GUARDIANS",
      "ALL_ATHLETES",
      "PROGRAM_MEMBERS",
      "MEMBERSHIP_HOLDERS",
      "INTERNAL_USERS",
      "CUSTOM",
    ]).optional(),
    filters: z.object({
      programIds: z.array(z.string()).optional(),
      membershipGroupIds: z.array(z.string()).optional(),
      membershipStatuses: z.array(z.string()).optional(),
      athleteStatuses: z.array(z.string()).optional(),
      userRoles: z.array(z.string()).optional(),
      includeInactive: z.boolean().optional(),
    }).optional(),
    ccEmails: z.array(z.string().email()).optional(),
  }).optional(),
});

// GET /api/notifications/rules/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const rule = await getNotificationRule(id);

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    // Verify the rule belongs to the user's organization
    if (rule.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(rule);
  } catch (error) {
    console.error("Error fetching notification rule:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification rule" },
      { status: 500 }
    );
  }
}

// PUT /api/notifications/rules/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("communication.send")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    
    // Verify the rule exists and belongs to the user's organization
    const existingRule = await getNotificationRule(id);
    if (!existingRule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    if (existingRule.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateRuleSchema.parse(body);

    const rule = await updateNotificationRule(id, validatedData);

    return NextResponse.json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "Cannot delete system notification rules") {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    console.error("Error updating notification rule:", error);
    return NextResponse.json(
      { error: "Failed to update notification rule" },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications/rules/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("communication.send")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    
    // Verify the rule exists and belongs to the user's organization
    const existingRule = await getNotificationRule(id);
    if (!existingRule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    if (existingRule.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteNotificationRule(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Cannot delete system notification rules") {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    console.error("Error deleting notification rule:", error);
    return NextResponse.json(
      { error: "Failed to delete notification rule" },
      { status: 500 }
    );
  }
}

// POST /api/notifications/rules/[id] - Execute/test the notification
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("communication.send")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    
    // Verify the rule exists and belongs to the user's organization
    const existingRule = await getNotificationRule(id);
    if (!existingRule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    if (existingRule.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    
    // Execute the notification
    const result = await executeNotification({
      ruleId: id,
      athleteId: body.athleteId,
      membershipId: body.membershipId,
      programId: body.programId,
      eventId: body.eventId,
      invoiceId: body.invoiceId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error executing notification:", error);
    return NextResponse.json(
      { error: "Failed to execute notification" },
      { status: 500 }
    );
  }
}
