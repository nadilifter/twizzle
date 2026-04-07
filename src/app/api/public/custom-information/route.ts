import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-resolver";
import { checkApiRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/public/custom-information
 *
 * Returns active custom info questions whose scopes match the provided registration context.
 * Query params: organizationId (required), plus optional comma-separated entity IDs:
 *   programIds, competitionIds, membershipIds, passIds, eventIds
 */
export async function GET(request: NextRequest) {
  const rateLimited = await checkApiRateLimit(request, "public");
  if (rateLimited) return rateLimited;

  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const enabled = await isFeatureEnabled(organizationId, "customInformation");
    if (!enabled) {
      return NextResponse.json({ questions: [], config: null });
    }

    const programIds = searchParams.get("programIds")?.split(",").filter(Boolean) ?? [];
    const competitionIds = searchParams.get("competitionIds")?.split(",").filter(Boolean) ?? [];
    const membershipIds = searchParams.get("membershipIds")?.split(",").filter(Boolean) ?? [];
    const passIds = searchParams.get("passIds")?.split(",").filter(Boolean) ?? [];
    const eventIds = searchParams.get("eventIds")?.split(",").filter(Boolean) ?? [];

    const allQuestions = await db.customInfoQuestion.findMany({
      where: { organizationId, isActive: true },
      include: { scopes: true },
      orderBy: { displayOrder: "asc" },
    });

    // Resolve season scopes: build per-season entity maps
    const seasonScopeIds = new Set<string>();
    for (const q of allQuestions) {
      for (const s of q.scopes) {
        if (s.scopeType === "SEASON" && s.targetId) {
          seasonScopeIds.add(s.targetId);
        }
      }
    }

    const seasonEntityMap = new Map<
      string,
      {
        programIds: Set<string>;
        competitionIds: Set<string>;
        membershipIds: Set<string>;
      }
    >();

    if (seasonScopeIds.size > 0) {
      const seasons = await db.season.findMany({
        where: { id: { in: [...seasonScopeIds] }, organizationId },
        include: {
          programs: { select: { id: true } },
          competitions: { select: { id: true } },
          memberships: { select: { id: true, instances: { select: { id: true } } } },
        },
      });

      for (const season of seasons) {
        const entry = {
          programIds: new Set(season.programs.map((p) => p.id)),
          competitionIds: new Set(season.competitions.map((c) => c.id)),
          membershipIds: new Set(season.memberships.flatMap((mg) => mg.instances.map((i) => i.id))),
        };
        seasonEntityMap.set(season.id, entry);
      }
    }

    const matchingQuestions = allQuestions.filter((q) => {
      return q.scopes.some((scope) => {
        switch (scope.scopeType) {
          case "ALL_PROGRAMS":
            return programIds.length > 0;
          case "ALL_EVENTS":
            return eventIds.length > 0;
          case "ALL_COMPETITIONS":
            return competitionIds.length > 0;
          case "ALL_MEMBERSHIPS":
            return membershipIds.length > 0;
          case "ALL_PASSES":
            return passIds.length > 0;
          case "PROGRAM":
            return scope.targetId && programIds.includes(scope.targetId);
          case "EVENT":
            return scope.targetId && eventIds.includes(scope.targetId);
          case "COMPETITION":
            return scope.targetId && competitionIds.includes(scope.targetId);
          case "MEMBERSHIP":
            return scope.targetId && membershipIds.includes(scope.targetId);
          case "PASS":
            return scope.targetId && passIds.includes(scope.targetId);
          case "SEASON": {
            if (!scope.targetId) return false;
            const seasonEntities = seasonEntityMap.get(scope.targetId);
            if (!seasonEntities) return false;
            return (
              programIds.some((id) => seasonEntities.programIds.has(id)) ||
              competitionIds.some((id) => seasonEntities.competitionIds.has(id)) ||
              membershipIds.some((id) => seasonEntities.membershipIds.has(id))
            );
          }
          default:
            return false;
        }
      });
    });

    const config = await db.customInfoConfig.findUnique({
      where: { organizationId },
    });

    return NextResponse.json({
      questions: matchingQuestions,
      config: config ?? { validityDays: 365 },
    });
  } catch (error) {
    console.error("Error fetching custom info questions:", error);
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
  }
}
