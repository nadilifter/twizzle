import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-resolver";
import { z } from "zod";

async function verifyGuardian(athleteId: string, email: string): Promise<boolean> {
  const guardian = await db.athleteGuardian.findFirst({
    where: { athleteId, user: { email } },
    select: { id: true },
  });
  return !!guardian;
}

/**
 * GET /api/public/athletes/[id]/custom-information?organizationId=xxx&email=xxx
 *
 * Returns existing custom info responses for the athlete+org, with validity check.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: athleteId } = await params;
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const paramEmail = searchParams.get("email");

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const session = await getAuthSession();
    const email = session?.user?.email || paramEmail;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const hasAccess = await verifyGuardian(athleteId, email);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const enabled = await isFeatureEnabled(organizationId, "customInformation");
    if (!enabled) {
      return NextResponse.json({ responses: [], isCurrent: true });
    }

    const responses = await db.customInfoResponse.findMany({
      where: { athleteId, organizationId },
      include: { question: { include: { scopes: true } } },
    });

    const now = new Date();
    const isCurrent =
      responses.length > 0 &&
      responses.every((r) => {
        if (r.question.validityDays == null) return true;
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - r.question.validityDays);
        return new Date(r.respondedAt) >= cutoff;
      });

    return NextResponse.json({
      responses,
      isCurrent,
    });
  } catch (error) {
    console.error("Error fetching custom info responses (public):", error);
    return NextResponse.json({ error: "Failed to fetch responses" }, { status: 500 });
  }
}

const responseSchema = z.object({
  organizationId: z.string(),
  responses: z.array(
    z.object({
      questionId: z.string(),
      responseValue: z.string().nullable().optional(),
      signatureData: z.string().nullable().optional(),
    })
  ),
});

/**
 * PUT /api/public/athletes/[id]/custom-information
 *
 * Upserts custom info responses for an athlete within an organization.
 * Requires authentication.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id: athleteId } = await params;
    const body = await request.json();
    const { organizationId, responses: responseData } = responseSchema.parse(body);

    const hasAccess = await verifyGuardian(athleteId, session.user.email);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const enabled = await isFeatureEnabled(organizationId, "customInformation");
    if (!enabled) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    // Validate question IDs belong to the org
    const questionIds = responseData.map((r) => r.questionId);
    const validQuestions = await db.customInfoQuestion.findMany({
      where: { id: { in: questionIds }, organizationId, isActive: true },
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

    const updatedResponses = await db.customInfoResponse.findMany({
      where: { athleteId, organizationId },
      include: { question: { include: { scopes: true } } },
    });

    return NextResponse.json({ responses: updatedResponses });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error saving custom info responses (public):", error);
    return NextResponse.json({ error: "Failed to save responses" }, { status: 500 });
  }
}
