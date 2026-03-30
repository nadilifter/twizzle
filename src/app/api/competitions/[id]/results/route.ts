import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { db } from "@/lib/db";
import { z } from "zod";

/**
 * GET /api/competitions/[id]/results
 * List results for a competition (filterable by category).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const gateResponse = await checkFeatureGate(organizationId, "competitions");
    if (gateResponse) return gateResponse;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");

    const competition = await db.competition.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    }

    const results = await db.competitionResult.findMany({
      where: {
        competitionId: id,
        ...(categoryId ? { competitionCategoryId: categoryId } : {}),
      },
      include: {
        athlete: {
          select: { id: true, firstName: true, lastName: true, name: true },
        },
        team: true,
        category: {
          select: {
            id: true,
            resultType: true,
            sortDirection: true,
            precision: true,
            combinationEntry: { include: { rowValue: true, colValue: true } },
            individualEntry: true,
          },
        },
      },
      orderBy: [{ competitionCategoryId: "asc" }, { placement: "asc" }],
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching results:", error);
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 });
  }
}

const createResultSchema = z.object({
  competitionCategoryId: z.string().min(1),
  athleteId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  value: z.number(),
  displayValue: z.string().nullable().optional(),
  placement: z.number().int().min(1).nullable().optional(),
  heat: z.number().int().min(1).nullable().optional(),
  isHandTimed: z.boolean().default(false),
  isPersonalBest: z.boolean().default(false),
  isDNF: z.boolean().default(false),
  isDNS: z.boolean().default(false),
  isDQ: z.boolean().default(false),
  attemptNumber: z.number().int().nullable().optional(),
  isBestAttempt: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

const batchCreateSchema = z.object({
  results: z.array(createResultSchema),
});

/**
 * POST /api/competitions/[id]/results
 * Record results (single or batch).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const gateResponse = await checkFeatureGate(organizationId, "competitions");
    if (gateResponse) return gateResponse;

    const { id } = await params;

    const competition = await db.competition.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    }

    const body = await request.json();

    // Support both single result and batch
    const isBatch = Array.isArray(body.results);
    const parsed = isBatch
      ? batchCreateSchema.parse(body)
      : { results: [createResultSchema.parse(body)] };

    const createdResults = await Promise.all(
      parsed.results.map((result) =>
        db.competitionResult.create({
          data: {
            competitionId: id,
            competitionCategoryId: result.competitionCategoryId,
            athleteId: result.athleteId || null,
            teamId: result.teamId || null,
            value: result.value,
            displayValue: result.displayValue || null,
            placement: result.placement ?? null,
            heat: result.heat ?? null,
            isHandTimed: result.isHandTimed,
            isPersonalBest: result.isPersonalBest,
            isDNF: result.isDNF,
            isDNS: result.isDNS,
            isDQ: result.isDQ,
            attemptNumber: result.attemptNumber ?? null,
            isBestAttempt: result.isBestAttempt,
            notes: result.notes || null,
            recordedBy: session.user.id,
          },
          include: {
            athlete: { select: { id: true, firstName: true, lastName: true, name: true } },
            team: true,
            category: { select: { id: true, resultType: true, sortDirection: true } },
          },
        })
      )
    );

    return NextResponse.json(isBatch ? createdResults : createdResults[0], { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues?.[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error recording results:", error);
    return NextResponse.json({ error: "Failed to record results" }, { status: 500 });
  }
}
