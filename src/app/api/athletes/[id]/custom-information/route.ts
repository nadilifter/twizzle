import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-resolver";
import { z } from "zod";

async function canAccessAthlete(session: any, athleteId: string): Promise<boolean> {
  const permissions = session.user.permissions ?? [];
  const isSuperAdmin = session.user.isSuperAdmin === true;
  const hasStaffAccess =
    isSuperAdmin ||
    permissions.includes("*") ||
    permissions.includes("athletes.view") ||
    permissions.includes("athletes.edit");

  if (hasStaffAccess) {
    const athlete = await db.athlete.findFirst({
      where: {
        id: athleteId,
        organizationAthletes: {
          some: { organizationId: session.user.organizationId },
        },
      },
    });
    return !!athlete;
  }

  const athlete = await db.athlete.findFirst({
    where: {
      id: athleteId,
      OR: [{ guardians: { some: { userId: session.user.id } } }, { userId: session.user.id }],
    },
  });
  return !!athlete;
}

function isAdmin(session: any): boolean {
  const permissions = session.user.permissions ?? [];
  return (
    session.user.isSuperAdmin === true ||
    permissions.includes("*") ||
    permissions.includes("athletes.edit")
  );
}

/**
 * GET /api/athletes/[id]/custom-information
 *
 * Returns all custom info responses for the athlete in the current organization.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: athleteId } = await params;
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const hasAccess = await canAccessAthlete(session, athleteId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const enabled = await isFeatureEnabled(organizationId, "customInformation");
    if (!enabled) {
      return NextResponse.json({ responses: [], questions: [] });
    }

    const scopedDb = getScopedDb(organizationId);
    const [responses, questions, config] = await Promise.all([
      scopedDb.customInfoResponse.findMany({
        where: { athleteId, organizationId },
        include: { question: { include: { scopes: true } } },
        orderBy: { question: { displayOrder: "asc" } },
      }),
      scopedDb.customInfoQuestion.findMany({
        where: { organizationId, isActive: true },
        include: { scopes: true },
        orderBy: { displayOrder: "asc" },
      }),
      scopedDb.customInfoConfig.findUnique({
        where: { organizationId },
        select: { validityDays: true },
      }),
    ]);

    return NextResponse.json({
      responses,
      questions,
      config: config ?? { validityDays: 365 },
    });
  } catch (error) {
    console.error("Error fetching athlete custom info:", error);
    return NextResponse.json({ error: "Failed to fetch custom info" }, { status: 500 });
  }
}

const updateResponseSchema = z.object({
  responses: z.array(
    z.object({
      questionId: z.string(),
      responseValue: z.string().nullable().optional(),
      signatureData: z.string().nullable().optional(),
    })
  ),
});

/**
 * PUT /api/athletes/[id]/custom-information
 *
 * Admin-only: update custom info responses for an athlete.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: athleteId } = await params;
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    if (!isAdmin(session)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const hasAccess = await canAccessAthlete(session, athleteId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const enabled = await isFeatureEnabled(organizationId, "customInformation");
    if (!enabled) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    const body = await request.json();
    const { responses: responseData } = updateResponseSchema.parse(body);

    const scopedDb = getScopedDb(organizationId);
    const questionIds = responseData.map((r) => r.questionId);
    const validQuestions = await scopedDb.customInfoQuestion.findMany({
      where: { id: { in: questionIds }, organizationId },
      select: { id: true },
    });
    const validIds = new Set(validQuestions.map((q) => q.id));

    const now = new Date();

    await db.$transaction(async (tx) => {
      for (const r of responseData) {
        if (!validIds.has(r.questionId)) continue;

        await tx.customInfoResponse.upsert({
          where: {
            athleteId_organizationId_questionId: {
              athleteId,
              organizationId,
              questionId: r.questionId,
            },
          },
          update: {
            responseValue: r.responseValue ?? null,
            signatureData: r.signatureData ?? null,
            respondedAt: now,
            respondedById: session.user.id,
          },
          create: {
            athleteId,
            organizationId,
            questionId: r.questionId,
            responseValue: r.responseValue ?? null,
            signatureData: r.signatureData ?? null,
            respondedAt: now,
            respondedById: session.user.id,
          },
        });
      }
    });

    const updatedResponses = await scopedDb.customInfoResponse.findMany({
      where: { athleteId, organizationId },
      include: { question: { include: { scopes: true } } },
      orderBy: { question: { displayOrder: "asc" } },
    });

    return NextResponse.json({ responses: updatedResponses });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating athlete custom info:", error);
    return NextResponse.json({ error: "Failed to update custom info" }, { status: 500 });
  }
}
