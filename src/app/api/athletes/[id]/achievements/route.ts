import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAthleteAchievementProgress } from "@/lib/services/achievement";

// GET /api/athletes/[id]/achievements
// Get all achievements for an athlete, including earned and in-progress
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: athleteId } = await params;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get("templateId");
    const earnedOnly = searchParams.get("earnedOnly") === "true";

    // Verify athlete belongs to organization
    const athlete = await db.athlete.findFirst({
      where: {
        id: athleteId,
        OR: [
          { organizationId: session.user.organizationId },
          {
            guardians: {
              some: {
                family: {
                  organizationId: session.user.organizationId,
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        level: true,
        avatar: true,
      },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // If templateId is provided, get progress for that specific template
    if (templateId) {
      const progress = await getAthleteAchievementProgress(athleteId, templateId);
      return NextResponse.json({
        athlete,
        templateId,
        ...progress,
      });
    }

    // Get all earned achievements for this athlete
    const earnedAchievements = await db.athleteAchievement.findMany({
      where: { athleteId },
      include: {
        achievement: {
          include: {
            template: {
              select: {
                id: true,
                name: true,
                levelId: true,
                level: true,
              },
            },
          },
        },
        evaluation: {
          select: {
            id: true,
            date: true,
            overallScore: true,
          },
        },
      },
      orderBy: { earnedAt: "desc" },
    });

    if (earnedOnly) {
      return NextResponse.json({
        athlete,
        earned: earnedAchievements.map((ea) => ({
          id: ea.id,
          achievementId: ea.achievement.id,
          name: ea.achievement.name,
          description: ea.achievement.description,
          badgeImageUrl: ea.achievement.badgeImageUrl,
          templateName: ea.achievement.template.name,
          templateLevelId: ea.achievement.template.levelId,
          templateLevel: ea.achievement.template.level,
          earnedAt: ea.earnedAt,
          bestResultsByCategory: ea.bestResultsByCategory,
          overallScore: ea.overallScore,
          evaluation: ea.evaluation,
        })),
      });
    }

    // Get all templates the athlete has been evaluated on (for in-progress achievements)
    const evaluatedTemplateIds = await db.evaluation.findMany({
      where: { athleteId },
      select: { templateId: true },
      distinct: ["templateId"],
    });

    const templateIds = evaluatedTemplateIds
      .map((e) => e.templateId)
      .filter((id): id is string => id !== null);

    // Get all achievements for evaluated templates
    const allAchievements = await db.achievement.findMany({
      where: {
        templateId: { in: templateIds },
        organizationId: session.user.organizationId,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            levelId: true,
            level: true,
            completionType: true,
            completionThreshold: true,
          },
        },
      },
    });

    // Build achievement map for earned
    const earnedMap = new Map(
      earnedAchievements.map((ea) => [ea.achievementId, ea])
    );

    // Get progress for each template
    const achievementsWithProgress = await Promise.all(
      allAchievements.map(async (achievement) => {
        const earned = earnedMap.get(achievement.id);
        
        if (earned) {
          return {
            id: achievement.id,
            name: achievement.name,
            description: achievement.description,
            badgeImageUrl: achievement.badgeImageUrl,
            templateId: achievement.templateId,
            templateName: achievement.template.name,
            templateLevelId: achievement.template.levelId,
            templateLevel: achievement.template.level,
            completionType: achievement.template.completionType,
            completionThreshold: achievement.template.completionThreshold,
            earned: true,
            earnedAt: earned.earnedAt,
            bestResultsByCategory: earned.bestResultsByCategory,
            overallScore: earned.overallScore,
            progress: null, // Already earned
          };
        }

        // Get progress for unearned achievements
        const progress = await getAthleteAchievementProgress(athleteId, achievement.templateId);
        const achievementProgress = progress.achievements.find((a) => a.id === achievement.id);

        return {
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          badgeImageUrl: achievement.badgeImageUrl,
          templateId: achievement.templateId,
          templateName: achievement.template.name,
          templateLevelId: achievement.template.levelId,
          templateLevel: achievement.template.level,
          completionType: achievement.template.completionType,
          completionThreshold: achievement.template.completionThreshold,
          earned: false,
          earnedAt: null,
          bestResultsByCategory: null,
          overallScore: null,
          progress: achievementProgress?.progress || null,
        };
      })
    );

    // Sort: earned first (by earnedAt desc), then unearned (by progress desc)
    achievementsWithProgress.sort((a, b) => {
      if (a.earned && !b.earned) return -1;
      if (!a.earned && b.earned) return 1;
      if (a.earned && b.earned) {
        return new Date(b.earnedAt!).getTime() - new Date(a.earnedAt!).getTime();
      }
      // Both unearned: sort by progress percentage
      const aProgress = a.progress?.percentage || 0;
      const bProgress = b.progress?.percentage || 0;
      return bProgress - aProgress;
    });

    return NextResponse.json({
      athlete,
      achievements: achievementsWithProgress,
      summary: {
        total: achievementsWithProgress.length,
        earned: achievementsWithProgress.filter((a) => a.earned).length,
        inProgress: achievementsWithProgress.filter((a) => !a.earned).length,
      },
    });
  } catch (error) {
    console.error("Error fetching athlete achievements:", error);
    return NextResponse.json(
      { error: "Failed to fetch athlete achievements" },
      { status: 500 }
    );
  }
}
