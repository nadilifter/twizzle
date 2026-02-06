import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { SkillAttemptStatus, ScoringType } from "@prisma/client";
import { checkAndAwardAchievements } from "@/lib/services/achievement";

const skillAttemptStatusEnum = z.enum(["NOT_ATTEMPTED", "ATTEMPTED", "SUCCEEDED"]);
const evaluationStatusEnum = z.enum(["PENDING", "IN_PROGRESS", "PASS", "RETRY", "EXCELLENT", "SATISFACTORY"]);

const skillRatingSchema = z.object({
  skillId: z.string().min(1),
  rating: z.number().int().min(1).max(5).optional().nullable(), // Legacy
  pointScore: z.number().int().optional().nullable(), // For POINT_SCALE
  attemptStatus: skillAttemptStatusEnum.optional(),
  passed: z.boolean().optional(), // Explicit pass flag
  comment: z.string().optional().nullable(),
});

const updateEvaluationSchema = z.object({
  date: z.string().optional(),
  level: z.string().optional(),
  overallScore: z.number().min(0).max(10).optional(),
  status: evaluationStatusEnum.optional(),
  notes: z.string().optional().nullable(),
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

// GET /api/evaluations/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const evaluation = await db.evaluation.findFirst({
      where: {
        id,
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
      },
      include: {
        athlete: {
          select: {
            id: true,
            name: true,
            level: true,
            avatar: true,
            birthDate: true,
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
          include: {
            skills: {
              include: {
                skill: true,
              },
              orderBy: { order: "asc" },
            },
            achievements: {
              select: {
                id: true,
                name: true,
                badgeImageUrl: true,
              },
            },
          },
        },
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

    if (!evaluation) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
    }

    return NextResponse.json(evaluation);
  } catch (error) {
    console.error("Error fetching evaluation:", error);
    return NextResponse.json(
      { error: "Failed to fetch evaluation" },
      { status: 500 }
    );
  }
}

// PUT /api/evaluations/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.update")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check if evaluation exists
    const existingEvaluation = await db.evaluation.findFirst({
      where: {
        id,
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
      },
      include: {
        skillRatings: true,
        template: {
          select: {
            scoringType: true,
            pointScalePassThreshold: true,
          },
        },
      },
    });

    if (!existingEvaluation) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateEvaluationSchema.parse(body);

    const { skillRatings, ...evaluationData } = validatedData;

    // Get template scoring configuration
    const scoringType = existingEvaluation.template?.scoringType || "PASS_FAIL";
    const passThreshold = existingEvaluation.template?.pointScalePassThreshold || 7;

    // Track which skills had status changes for progress updates
    const previousRatings = new Map(
      existingEvaluation.skillRatings.map((sr) => [sr.skillId, { attemptStatus: sr.attemptStatus, passed: sr.passed }])
    );

    // Calculate passed status for each skill rating
    const skillRatingsWithPassed = skillRatings?.map((sr) => {
      const passed = sr.passed ?? isSkillPassed(
        scoringType,
        sr.attemptStatus || "NOT_ATTEMPTED",
        sr.pointScore,
        passThreshold
      );
      return { ...sr, passed };
    });

    // Update evaluation and skill ratings in a transaction
    const evaluation = await db.$transaction(async (tx) => {
      // Update evaluation fields
      await tx.evaluation.update({
        where: { id },
        data: {
          ...evaluationData,
          ...(evaluationData.date && { date: new Date(evaluationData.date) }),
        },
      });

      // If skillRatings provided, update them
      if (skillRatingsWithPassed && skillRatingsWithPassed.length > 0) {
        for (const sr of skillRatingsWithPassed) {
          await tx.evaluationSkill.upsert({
            where: {
              evaluationId_skillId: {
                evaluationId: id,
                skillId: sr.skillId,
              },
            },
            update: {
              rating: sr.rating,
              pointScore: sr.pointScore,
              attemptStatus: sr.attemptStatus,
              passed: sr.passed,
              comment: sr.comment,
            },
            create: {
              evaluationId: id,
              skillId: sr.skillId,
              rating: sr.rating,
              pointScore: sr.pointScore,
              attemptStatus: sr.attemptStatus || "NOT_ATTEMPTED",
              passed: sr.passed,
              comment: sr.comment,
            },
          });
        }
      }

      // Fetch and return updated evaluation
      return tx.evaluation.findUnique({
        where: { id },
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
              difficultyLevel: true,
              scoringType: true,
              pointScaleMin: true,
              pointScaleMax: true,
              pointScalePassThreshold: true,
            },
          },
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
    });

    // Update athlete skill progress for skills that changed
    // Only if evaluation is not PENDING
    const newStatus = validatedData.status || existingEvaluation.status;
    if (skillRatingsWithPassed && newStatus !== "PENDING" && evaluation) {
      const evalDate = validatedData.date 
        ? new Date(validatedData.date) 
        : existingEvaluation.date;
        
      for (const sr of skillRatingsWithPassed) {
        const previous = previousRatings.get(sr.skillId);
        const previousStatus = previous?.attemptStatus || "NOT_ATTEMPTED";
        const previousPassed = previous?.passed || false;
        const newAttemptStatus = sr.attemptStatus || "NOT_ATTEMPTED";
        const newPassed = sr.passed;
        
        // Only update progress if status changed to something better
        const statusImproved = (
          (newAttemptStatus !== "NOT_ATTEMPTED" && previousStatus === "NOT_ATTEMPTED") ||
          (newAttemptStatus === "SUCCEEDED" && previousStatus === "ATTEMPTED") ||
          (newPassed && !previousPassed)
        );

        if (statusImproved) {
          await updateAthleteSkillProgress(
            existingEvaluation.athleteId,
            sr.skillId,
            newAttemptStatus,
            newPassed,
            id,
            evalDate
          );
        }
      }
    }

    // Check and award achievements if evaluation is being completed
    const completedStatuses = ["PASS", "EXCELLENT", "SATISFACTORY"];
    const wasNotCompleted = !completedStatuses.includes(existingEvaluation.status);
    const isNowCompleted = completedStatuses.includes(newStatus);

    if (wasNotCompleted && isNowCompleted && evaluation) {
      const awardedAchievements = await checkAndAwardAchievements(id);
      if (awardedAchievements.length > 0) {
        // Fetch the updated evaluation with achievements
        const updatedEvaluation = await db.evaluation.findUnique({
          where: { id },
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
                difficultyLevel: true,
                scoringType: true,
                pointScaleMin: true,
                pointScaleMax: true,
                pointScalePassThreshold: true,
              },
            },
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

    return NextResponse.json(evaluation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating evaluation:", error);
    return NextResponse.json(
      { error: "Failed to update evaluation" },
      { status: 500 }
    );
  }
}

// DELETE /api/evaluations/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check if evaluation exists
    const existingEvaluation = await db.evaluation.findFirst({
      where: {
        id,
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
      },
    });

    if (!existingEvaluation) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
    }

    // Delete evaluation (cascade will delete skill ratings)
    await db.evaluation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting evaluation:", error);
    return NextResponse.json(
      { error: "Failed to delete evaluation" },
      { status: 500 }
    );
  }
}
