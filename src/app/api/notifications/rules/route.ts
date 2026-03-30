import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { z } from "zod";
import {
  getNotificationRules,
  createNotificationRule,
  createSystemRulesForOrganization,
} from "@/lib/notification-service";

const createRuleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  triggerType: z.enum([
    "MEMBERSHIP_EXPIRY",
    "MEMBERSHIP_EXPIRED",
    "PAYMENT_DUE",
    "PAYMENT_OVERDUE",
    "PAYMENT_RECEIVED",
    "PROGRAM_REMINDER",
    "PROGRAM_ENROLLMENT",
    "PROGRAM_CANCELLATION",
    "EVENT_REMINDER",
    "EVENT_REGISTRATION_OPEN",
    "EVENT_REGISTRATION_CLOSE",
    "ATTENDANCE_MISSED",
    "SKILL_ACHIEVED",
    "EVALUATION_DUE",
    "EVALUATION_COMPLETED",
    "BIRTHDAY",
    "WAITLIST_OPENING",
    "CUSTOM",
  ]),
  timingValue: z.number().min(0).default(0),
  timingUnit: z.enum(["MINUTES", "HOURS", "DAYS", "WEEKS", "MONTHS"]).default("DAYS"),
  timingDirection: z.enum(["BEFORE", "AFTER", "AT"]).default("BEFORE"),
  actionType: z.enum(["ANNOUNCEMENT", "EMAIL", "SMS"]),
  template: z.object({
    subject: z.string().optional(),
    body: z.string().min(1, "Template body is required"),
    smsBody: z.string().optional(),
  }),
  recipientConfig: z.object({
    recipientType: z
      .enum(["GUARDIANS", "MEMBERSHIP_HOLDERS", "INTERNAL_USERS", "CUSTOM"])
      .default("GUARDIANS"),
    filters: z
      .object({
        membershipGroupIds: z.array(z.string()).optional(),
        membershipStatuses: z.array(z.string()).optional(),
        athleteStatuses: z.array(z.string()).optional(),
        userRoles: z.array(z.string()).optional(),
        includeInactive: z.boolean().optional(),
      })
      .optional(),
    ccEmails: z.array(z.string().email()).optional(),
  }),
});

// GET /api/notifications/rules
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const triggerType = searchParams.get("triggerType") as any;
    const ensureSystemRules = searchParams.get("ensureSystemRules") === "true";

    // Optionally ensure system rules exist
    if (ensureSystemRules) {
      await createSystemRulesForOrganization(session.user.organizationId);
    }

    const rules = await getNotificationRules(session.user.organizationId, {
      includeInactive,
      triggerType: triggerType || undefined,
    });

    return NextResponse.json({
      data: rules,
      total: rules.length,
    });
  } catch (error) {
    console.error("Error fetching notification rules:", error);
    return NextResponse.json({ error: "Failed to fetch notification rules" }, { status: 500 });
  }
}

// POST /api/notifications/rules
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validatedData = createRuleSchema.parse(body);

    const rule = await createNotificationRule({
      organizationId: session.user.organizationId,
      name: validatedData.name,
      description: validatedData.description,
      triggerType: validatedData.triggerType,
      timingValue: validatedData.timingValue,
      timingUnit: validatedData.timingUnit,
      timingDirection: validatedData.timingDirection,
      actionType: validatedData.actionType,
      template: validatedData.template,
      recipientConfig: validatedData.recipientConfig,
    });

    return NextResponse.json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating notification rule:", error);
    return NextResponse.json({ error: "Failed to create notification rule" }, { status: 500 });
  }
}
