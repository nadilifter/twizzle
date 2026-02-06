import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/athletes/[id]/skills - Get athlete's skill progress
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
    const category = searchParams.get("category");
    const levelId = searchParams.get("levelId");

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
    });

    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // Get all skills for the organization with optional filters
    const skillWhere = {
      organizationId: session.user.organizationId,
      ...(category && { category }),
      ...(levelId && { levelId }),
    };

    // Get all skills and athlete's progress
    const [skills, progressRecords] = await Promise.all([
      db.skill.findMany({
        where: skillWhere,
        orderBy: [{ category: "asc" }, { name: "asc" }],
        include: { skillLevel: true },
      }),
      db.athleteSkillProgress.findMany({
        where: {
          athleteId,
          skill: skillWhere,
        },
        include: {
          skill: true,
        },
      }),
    ]);

    // Create a map of skill progress
    const progressMap = new Map(
      progressRecords.map((p) => [p.skillId, p])
    );

    // Build response with all skills and their progress (or default if no progress)
    const data = skills.map((skill) => {
      const progress = progressMap.get(skill.id);
      return {
        id: progress?.id || null,
        athleteId,
        skillId: skill.id,
        bestStatus: progress?.bestStatus || "NOT_ATTEMPTED",
        firstAttemptedAt: progress?.firstAttemptedAt?.toISOString() || null,
        firstSucceededAt: progress?.firstSucceededAt?.toISOString() || null,
        attemptCount: progress?.attemptCount || 0,
        successCount: progress?.successCount || 0,
        lastEvaluatedAt: progress?.lastEvaluatedAt?.toISOString() || null,
        lastEvaluationId: progress?.lastEvaluationId || null,
        skill,
      };
    });

    // Calculate summary statistics
    const summary = {
      total: data.length,
      notAttempted: data.filter((d) => d.bestStatus === "NOT_ATTEMPTED").length,
      attempted: data.filter((d) => d.bestStatus === "ATTEMPTED").length,
      succeeded: data.filter((d) => d.bestStatus === "SUCCEEDED").length,
    };

    // Group by category
    const byCategory: Record<string, typeof summary> = {};
    for (const item of data) {
      const cat = item.skill.category;
      if (!byCategory[cat]) {
        byCategory[cat] = { total: 0, notAttempted: 0, attempted: 0, succeeded: 0 };
      }
      byCategory[cat].total++;
      if (item.bestStatus === "NOT_ATTEMPTED") {
        byCategory[cat].notAttempted++;
      } else if (item.bestStatus === "ATTEMPTED") {
        byCategory[cat].attempted++;
      } else if (item.bestStatus === "SUCCEEDED") {
        byCategory[cat].succeeded++;
      }
    }

    return NextResponse.json({
      data,
      summary,
      byCategory,
    });
  } catch (error) {
    console.error("Error fetching athlete skill progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch athlete skill progress" },
      { status: 500 }
    );
  }
}
