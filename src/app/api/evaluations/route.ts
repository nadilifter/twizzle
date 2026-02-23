import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";
import type { SkillAttemptStatus, ScoringType } from "@prisma/client";
import { checkAndAwardAchievements } from "@/lib/services/achievement";

const skillAttemptStatusEnum = z.enum(["NOT_ATTEMPTED", "ATTEMPTED", "SUCCEEDED"]);
const evaluationStatusEnum = z.enum(["PENDING", "IN_PROGRESS", "PASS", "RETRY", "EXCELLENT", "SATISFACTORY"]);

const skillRatingSchema = z.object({
  skillId: z.string().min(1),
  rating: z.number().int().min(1).max(5).optional().nullable(), // Legacy
  pointScore: z.number().int().optional().nullable(), // For POINT_SCALE
  attemptStatus: skillAttemptStatusEnum.optional().default("NOT_ATTEMPTED"),
  passed: z.boolean().optional(), // Explicit pass flag
  comment: z.string().optional(),
});

const createEvaluationSchema = z.object({
  athleteId: z.string().min(1, "Athlete is required"),
  templateId: z.string().optional(), // Optional - can create from template
  programId: z.string().optional(), // Optional - link to program
  date: z.string().min(1, "Date is required"),
  levelId: z.string().optional(), // Optional if using template
  overallScore: z.number().min(0).max(10).optional().default(0),
  status: evaluationStatusEnum.optional().default("PENDING"),
  notes: z.string().optional(),
  skillRatings: z.array(skillRatingSchema).optional(),
});

// Helper function to determine if a skill is passed based on scoring type
function isSkillPassed(
  scoringType: ScoringType,
  attemptStatus: SkillAttemptStatus,
  pointScore: number | null | undefined,
  passThreshold: number
): boolean {
  if (scoringType === "PASS_FAIL") {
    return attemptStatus === "SUCCEEDED";
  } else {
    // POINT_SCALE
    return pointScore !== null && pointScore !== undefined && pointScore >= passThreshold;
  }
}

// Helper function to update athlete skill progress
async function updateAthleteSkillProgress(
  athleteId: string,
  skillId: string,
  attemptStatus: SkillAttemptStatus,
  passed: boolean,
  evaluationId: string,
  evaluationDate: Date
) {
  const now = new Date();
  
  // Get existing progress record
  const existingProgress = await db.athleteSkillProgress.findUnique({
    where: {
      athleteId_skillId: { athleteId, skillId },
    },
  });

  if (existingProgress) {
    // Update existing progress
    const updateData: Record<string, unknown> = {
      lastEvaluatedAt: evaluationDate,
      lastEvaluationId: evaluationId,
      updatedAt: now,
    };

    if (attemptStatus === "ATTEMPTED" || passed) {
      updateData.attemptCount = existingProgress.attemptCount + 1;
      if (!existingProgress.firstAttemptedAt) {
        updateData.firstAttemptedAt = evaluationDate;
      }
      // Upgrade bestStatus if current is NOT_ATTEMPTED
      if (existingProgress.bestStatus === "NOT_ATTEMPTED") {
        updateData.bestStatus = "ATTEMPTED";
      }
    }
    
    if (attemptStatus === "SUCCEEDED" || passed) {
      updateData.successCount = existingProgress.successCount + 1;
      if (!existingProgress.firstSucceededAt) {
        updateData.firstSucceededAt = evaluationDate;
      }
      // Upgrade bestStatus to SUCCEEDED
      updateData.bestStatus = "SUCCEEDED";
    }

    await db.athleteSkillProgress.update({
      where: { athleteId_skillId: { athleteId, skillId } },
      data: updateData,
    });
  } else {
    // Create new progress record
    const isPassed = attemptStatus === "SUCCEEDED" || passed;
    const isAttempted = attemptStatus !== "NOT_ATTEMPTED" || passed;
    
    await db.athleteSkillProgress.create({
      data: {
        athleteId,
        skillId,
        bestStatus: isPassed ? "SUCCEEDED" : (isAttempted ? "ATTEMPTED" : "NOT_ATTEMPTED"),
        firstAttemptedAt: isAttempted ? evaluationDate : null,
        firstSucceededAt: isPassed ? evaluationDate : null,
        attemptCount: isAttempted ? 1 : 0,
        successCount: isPassed ? 1 : 0,
        lastEvaluatedAt: evaluationDate,
        lastEvaluationId: evaluationId,
      },
    });
  }
}

// GET /api/evaluations
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trainingBlocked = await checkFeatureGate(session.user.organizationId, "training");
    if (trainingBlocked) return trainingBlocked;

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");
    const coachId = searchParams.get("coachId");
    const templateId = searchParams.get("templateId");
    const programId = searchParams.get("programId");
    const status = searchParams.get("status");
    const levelId = searchParams.get("levelId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause - check organization via athlete's organization or guardians
    const where = {
      OR: [
        {
          athlete: {
            organizationId: session.user.organizationId,
          },
        },
        {
          athlete: {
            guardians: {
              some: {
                family: {
                  organizationId: session.user.organizationId,
                },
              },
            },
          },
        },
      ],
      ...(athleteId && { athleteId }),
      ...(coachId && { coachId }),
      ...(templateId && { templateId }),
      ...(programId && { programId }),
      ...(status && { status: status as "PENDING" | "IN_PROGRESS" | "PASS" | "RETRY" | "EXCELLENT" | "SATISFACTORY" }),
      ...(levelId && { levelId }),
      ...(startDate && endDate && {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
    };

    const [evaluations, total] = await Promise.all([
      db.evaluation.findMany({
        where,
        include: {
          athlete: {
            select: {
              id: true,
              name: true,
              level: true,
              avatar: true,
            },
          },
          coach: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          template: {
            select: {
              id: true,
              name: true,
              levelId: true,
              level: true,
              scoringType: true,
              pointScaleMin: true,
              pointScaleMax: true,
              pointScalePassThreshold: true,
              completionType: true,
              completionThreshold: true,
            },
          },
          level: true,
          program: {
            select: {
              id: true,
              name: true,
            },
          },
          skillRatings: {
            include: {
              skill: true,
            },
          },
          athleteAchievements: {
            include: {
              achievement: {
                select: {
                  id: true,
                  name: true,
                  badgeImageUrl: true,
                },
              },
            },
          },
        },
        orderBy: { date: "desc" },
        take: limit,
        skip: offset,
      }),
      db.evaluation.count({ where }),
    ]);

    return NextResponse.json({
      data: evaluations,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching evaluations:", error);
    return NextResponse.json(
      { error: "Failed to fetch evaluations" },
      { status: 500 }
    );
  }
}

// POST /api/evaluations
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trainingBlockedPost = await checkFeatureGate(session.user.organizationId, "training");
    if (trainingBlockedPost) return trainingBlockedPost;

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createEvaluationSchema.parse(body);

    // Verify athlete belongs to organization (via direct org link or guardians)
    const athlete = await db.athlete.findFirst({
      where: {
        id: validatedData.athleteId,
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

    // If programId provided, verify it exists and athlete is enrolled
    if (validatedData.programId) {
      const program = await db.program.findFirst({
        where: {
          id: validatedData.programId,
          organizationId: session.user.organizationId,
        },
      });

      if (!program) {
        return NextResponse.json({ error: "Program not found" }, { status: 404 });
      }

      const enrollment = await db.enrollment.findFirst({
        where: {
          programId: validatedData.programId,
          athleteId: validatedData.athleteId,
          status: "ACTIVE",
        },
      });

      if (!enrollment) {
        return NextResponse.json(
          { error: "Athlete is not enrolled in this program" },
          { status: 400 }
        );
      }
    }

    // If template provided, load template details
    let templateSkillIds: string[] = [];
    let levelId = validatedData.levelId;
    let scoringType: ScoringType = "PASS_FAIL";
    let pointScalePassThreshold = 7;
    
    if (validatedData.templateId) {
      const template = await db.evaluationTemplate.findFirst({
        where: {
          id: validatedData.templateId,
          organizationId: session.user.organizationId,
          isActive: true,
        },
        include: {
          skills: {
            orderBy: { order: "asc" },
          },
        },
      });

      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }

      templateSkillIds = template.skills.map((s) => s.skillId);
      scoringType = template.scoringType;
      pointScalePassThreshold = template.pointScalePassThreshold;
      
      // Use template's level if level not provided
      if (!levelId) {
        levelId = template.levelId;
      }
    }

    // Determine skill ratings to create
    let skillRatingsToCreate = validatedData.skillRatings || [];
    
    // If using template and no skillRatings provided, create entries for all template skills
    if (validatedData.templateId && templateSkillIds.length > 0 && skillRatingsToCreate.length === 0) {
      skillRatingsToCreate = templateSkillIds.map((skillId) => ({
        skillId,
        attemptStatus: "NOT_ATTEMPTED" as const,
        passed: false,
      }));
    }

    // Calculate passed status for each skill rating
    const skillRatingsWithPassed = skillRatingsToCreate.map((sr) => {
      const passed = sr.passed ?? isSkillPassed(
        scoringType,
        sr.attemptStatus || "NOT_ATTEMPTED",
        sr.pointScore,
        pointScalePassThreshold
      );
      return { ...sr, passed };
    });

    const evaluation = await db.evaluation.create({
      data: {
        athleteId: validatedData.athleteId,
        coachId: session.user.id,
        templateId: validatedData.templateId,
        programId: validatedData.programId,
        date: new Date(validatedData.date),
        levelId: levelId ?? undefined,
        overallScore: validatedData.overallScore || 0,
        status: validatedData.status || "PENDING",
        notes: validatedData.notes,
        skillRatings: skillRatingsWithPassed.length > 0 ? {
          create: skillRatingsWithPassed.map((sr) => ({
            skillId: sr.skillId,
            rating: sr.rating,
            pointScore: sr.pointScore,
            attemptStatus: sr.attemptStatus || "NOT_ATTEMPTED",
            passed: sr.passed,
            comment: sr.comment,
          })),
        } : undefined,
      },
      include: {
        athlete: {
          select: {
            id: true,
            name: true,
            level: true,
            avatar: true,
          },
        },
        coach: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        template: {
            select: {
              id: true,
              name: true,
              levelId: true,
              level: true,
              scoringType: true,
              pointScaleMin: true,
              pointScaleMax: true,
              pointScalePassThreshold: true,
            },
          },
          level: true,
          program: {
            select: {
              id: true,
              name: true,
            },
          },
          skillRatings: {
            include: {
              skill: true,
            },
          },
        },
      });

    // Update athlete skill progress for each skill rating (only if not PENDING)
    if (validatedData.status && validatedData.status !== "PENDING") {
      for (const sr of skillRatingsWithPassed) {
        if ((sr.attemptStatus && sr.attemptStatus !== "NOT_ATTEMPTED") || sr.passed) {
          await updateAthleteSkillProgress(
            validatedData.athleteId,
            sr.skillId,
            sr.attemptStatus || "NOT_ATTEMPTED",
            sr.passed,
            evaluation.id,
            new Date(validatedData.date)
          );
        }
      }

      // Check and award achievements if evaluation is completed
      const completedStatuses = ["PASS", "EXCELLENT", "SATISFACTORY"];
      if (completedStatuses.includes(validatedData.status)) {
        const awardedAchievements = await checkAndAwardAchievements(evaluation.id);
        if (awardedAchievements.length > 0) {
          // Fetch the updated evaluation with achievements
          const updatedEvaluation = await db.evaluation.findUnique({
            where: { id: evaluation.id },
            include: {
              athlete: {
                select: {
                  id: true,
                  name: true,
                  level: true,
                  avatar: true,
                },
              },
              coach: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                },
              },
              template: {
                select: {
                  id: true,
                  name: true,
                  levelId: true,
                  level: true,
                  scoringType: true,
                  pointScaleMin: true,
                  pointScaleMax: true,
                  pointScalePassThreshold: true,
                },
              },
              level: true,
              program: {
                select: {
                  id: true,
                  name: true,
                },
              },
              skillRatings: {
                include: {
                  skill: true,
                },
              },
              athleteAchievements: {
                include: {
                  achievement: {
                    select: {
                      id: true,
                      name: true,
                      badgeImageUrl: true,
                    },
                  },
                },
              },
            },
          });

          return NextResponse.json({
            ...updatedEvaluation,
            newAchievements: awardedAchievements,
          });
        }
      }
    }

    return NextResponse.json(evaluation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating evaluation:", error);
    return NextResponse.json(
      { error: "Failed to create evaluation" },
      { status: 500 }
    );
  }
}
