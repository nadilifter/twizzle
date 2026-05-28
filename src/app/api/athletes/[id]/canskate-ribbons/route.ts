import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
// Allowlisted in scripts/tenant-isolation-allowlist.txt — every query in this
// route is either filtered by organizationId directly (Achievement) or scoped
// by athleteId after a visibility check that requires the athlete to belong
// to the caller's org (or be linked as a guardian / self-athlete).

/**
 * GET /api/athletes/[id]/canskate-ribbons
 *
 * Returns the full CanSkate ribbon catalog for the athlete's org with
 * per-ribbon earned status and progress. Unlike the generic achievements
 * endpoint, this surfaces every ribbon — even ones the athlete has not
 * been evaluated on yet — so the UI can render the full progression grid.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: athleteId } = await params;
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization context" }, { status: 400 });
    }

    // Visibility check: athlete must be in this org OR linked to the user
    const athlete = await db.athlete.findFirst({
      where: {
        id: athleteId,
        OR: [
          { organizationAthletes: { some: { organizationId } } },
          { guardians: { some: { userId: session.user.id } } },
          { userId: session.user.id },
        ],
      },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // CanSkate ribbon Achievement rows live under a deterministic ID prefix.
    const achievements = await db.achievement.findMany({
      where: {
        organizationId,
        id: { startsWith: `${organizationId}-canskate-ach-` },
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            skills: { select: { skillId: true, isRequired: true } },
          },
        },
      },
    });

    if (achievements.length === 0) {
      return NextResponse.json({ ribbons: [], summary: { total: 0, earned: 0 } });
    }

    // Earned records for this athlete
    const earned = await db.athleteAchievement.findMany({
      where: {
        athleteId,
        achievementId: { in: achievements.map((a) => a.id) },
      },
      select: { achievementId: true, earnedAt: true },
    });
    const earnedById = new Map(earned.map((e) => [e.achievementId, e.earnedAt]));

    // Latest skill progress for this athlete — used to compute per-ribbon completion
    const progress = await db.athleteSkillProgress.findMany({
      where: { athleteId },
      select: { skillId: true, bestStatus: true },
    });
    const passedSkillIds = new Set(
      progress.filter((p) => p.bestStatus === "SUCCEEDED").map((p) => p.skillId)
    );

    type Ribbon = {
      id: string;
      name: string;
      description: string | null;
      stage: number;
      dimension: string;
      templateId: string;
      requiredCount: number;
      passedCount: number;
      percentage: number;
      earned: boolean;
      earnedAt: string | null;
    };

    const ribbons: Ribbon[] = achievements.map((a) => {
      const requiredSkillIds = a.template.skills.filter((s) => s.isRequired).map((s) => s.skillId);
      const passedCount = requiredSkillIds.filter((id) => passedSkillIds.has(id)).length;
      const requiredCount = requiredSkillIds.length;
      const percentage = requiredCount > 0 ? Math.round((passedCount / requiredCount) * 100) : 0;
      const earnedAt = earnedById.get(a.id) ?? null;

      // Parse "CanSkate 3 - Balance Ribbon" / "Pre-CanSkate Achievement"
      const match = a.name.match(/CanSkate\s+(\d)\s*-\s*(\w+)/i);
      const stage = match ? parseInt(match[1], 10) : 0;
      const dimension = match ? match[2] : "Achievement";

      return {
        id: a.id,
        name: a.name,
        description: a.description,
        stage,
        dimension,
        templateId: a.templateId,
        requiredCount,
        passedCount,
        percentage,
        earned: Boolean(earnedAt),
        earnedAt: earnedAt ? earnedAt.toISOString() : null,
      };
    });

    // Stable sort: stage asc, then Balance / Control / Agility / Achievement
    const dimOrder: Record<string, number> = {
      Balance: 0,
      Control: 1,
      Agility: 2,
      Achievement: 0,
    };
    ribbons.sort((a, b) => {
      if (a.stage !== b.stage) return a.stage - b.stage;
      return (dimOrder[a.dimension] ?? 99) - (dimOrder[b.dimension] ?? 99);
    });

    return NextResponse.json({
      ribbons,
      summary: {
        total: ribbons.length,
        earned: ribbons.filter((r) => r.earned).length,
      },
    });
  } catch (error) {
    console.error("Error fetching CanSkate ribbons:", error);
    return NextResponse.json({ error: "Failed to fetch ribbons" }, { status: 500 });
  }
}
