import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { SkillAttemptStatus } from "@prisma/client";

const skillAttemptStatusEnum = z.enum(["NOT_ATTEMPTED", "ATTEMPTED", "SUCCEEDED"]);
const evaluationStatusEnum = z.enum(["PENDING", "IN_PROGRESS", "PASS", "RETRY", "EXCELLENT", "SATISFACTORY"]);

const skillRatingSchema = z.object({
  skillId: z.string().min(1),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  attemptStatus: skillAttemptStatusEnum.optional(),
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

// Helper function to update athlete skill progress
async function updateAthleteSkillProgress(
  athleteId: string,
  skillId: string,
  attemptStatus: SkillAttemptStatus,
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

    if (attemptStatus === "ATTEMPTED") {
      updateData.attemptCount = existingProgress.attemptCount + 1;
      if (!existingProgress.firstAttemptedAt) {
        updateData.firstAttemptedAt = evaluationDate;
      }
      // Upgrade bestStatus if current is NOT_ATTEMPTED
      if (existingProgress.bestStatus === "NOT_ATTEMPTED") {
        updateData.bestStatus = "ATTEMPTED";
      }
    } else if (attemptStatus === "SUCCEEDED") {
      updateData.attemptCount = existingProgress.attemptCount + 1;
      updateData.successCount = existingProgress.successCount + 1;
      if (!existingProgress.firstAttemptedAt) {
        updateData.firstAttemptedAt = evaluationDate;
      }
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
    await db.athleteSkillProgress.create({
      data: {
        athleteId,
        skillId,
        bestStatus: attemptStatus,
        firstAttemptedAt: attemptStatus !== "NOT_ATTEMPTED" ? evaluationDate : null,
        firstSucceededAt: attemptStatus === "SUCCEEDED" ? evaluationDate : null,
        attemptCount: attemptStatus !== "NOT_ATTEMPTED" ? 1 : 0,
        successCount: attemptStatus === "SUCCEEDED" ? 1 : 0,
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
          },
        },
        skillRatings: {
          include: {
            skill: true,
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
      },
    });

    if (!existingEvaluation) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateEvaluationSchema.parse(body);

    const { skillRatings, ...evaluationData } = validatedData;

    // Track which skills had status changes for progress updates
    const previousRatings = new Map(
      existingEvaluation.skillRatings.map((sr) => [sr.skillId, sr.attemptStatus])
    );

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
      if (skillRatings && skillRatings.length > 0) {
        for (const sr of skillRatings) {
          await tx.evaluationSkill.upsert({
            where: {
              evaluationId_skillId: {
                evaluationId: id,
                skillId: sr.skillId,
              },
            },
            update: {
              rating: sr.rating,
              attemptStatus: sr.attemptStatus,
              comment: sr.comment,
            },
            create: {
              evaluationId: id,
              skillId: sr.skillId,
              rating: sr.rating,
              attemptStatus: sr.attemptStatus || "NOT_ATTEMPTED",
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
          template: true,
          skillRatings: {
            include: {
              skill: true,
            },
          },
        },
      });
    });

    // Update athlete skill progress for skills that changed to ATTEMPTED or SUCCEEDED
    // Only if evaluation is not PENDING
    if (skillRatings && validatedData.status !== "PENDING" && evaluation) {
      const evalDate = validatedData.date 
        ? new Date(validatedData.date) 
        : existingEvaluation.date;
        
      for (const sr of skillRatings) {
        const previousStatus = previousRatings.get(sr.skillId) || "NOT_ATTEMPTED";
        const newStatus = sr.attemptStatus || "NOT_ATTEMPTED";
        
        // Only update progress if status changed to something better
        if (
          newStatus !== "NOT_ATTEMPTED" &&
          (previousStatus === "NOT_ATTEMPTED" || 
           (previousStatus === "ATTEMPTED" && newStatus === "SUCCEEDED"))
        ) {
          await updateAthleteSkillProgress(
            existingEvaluation.athleteId,
            sr.skillId,
            newStatus,
            id,
            evalDate
          );
        }
      }
    }

    return NextResponse.json(evaluation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
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
