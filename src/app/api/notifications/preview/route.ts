import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { z } from "zod";
import {
  renderTemplatePreview,
  validateTemplate,
  extractPlaceholders,
  getTemplatePlaceholderSummary,
} from "@/lib/notification-template-service";
import { buildTemplateContext } from "@/lib/notification-service";
import type { NotificationTriggerType } from "@prisma/client";

const previewSchema = z.object({
  template: z.string().min(1, "Template is required"),
  triggerType: z
    .enum([
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
    ])
    .optional(),
  // Optional context IDs for real data preview
  athleteId: z.string().optional(),
  membershipId: z.string().optional(),
  programId: z.string().optional(),
  eventId: z.string().optional(),
  invoiceId: z.string().optional(),
});

// POST /api/notifications/preview
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = previewSchema.parse(body);

    // Validate the template
    const validation = validateTemplate(
      validatedData.template,
      validatedData.triggerType || "CUSTOM"
    );

    // Get placeholder summary
    const placeholderSummary = getTemplatePlaceholderSummary(validatedData.template);
    const usedPlaceholders = extractPlaceholders(validatedData.template);

    // Determine preview type
    const hasContextData =
      validatedData.athleteId ||
      validatedData.membershipId ||
      validatedData.programId ||
      validatedData.eventId ||
      validatedData.invoiceId;

    let preview: string;

    if (hasContextData) {
      // Render with real data
      const context = await buildTemplateContext(session.user.organizationId, {
        athleteId: validatedData.athleteId,
        membershipId: validatedData.membershipId,
        programId: validatedData.programId,
        eventId: validatedData.eventId,
        invoiceId: validatedData.invoiceId,
      });

      // Replace placeholders with context values
      preview = validatedData.template;
      for (const [key, value] of Object.entries(context)) {
        if (value !== undefined && value !== null) {
          preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
        }
      }
    } else {
      // Render with example values
      preview = renderTemplatePreview(validatedData.template);
    }

    return NextResponse.json({
      preview,
      validation,
      usedPlaceholders,
      placeholderSummary,
      isValidTemplate: validation.isValid,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error generating preview:", error);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
