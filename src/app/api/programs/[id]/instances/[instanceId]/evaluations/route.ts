import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { checkAndAwardAchievements } from "@/lib/services/achievement";

const bulkUpdateSchema = z.object({
  evaluations: z.array(
    z.object({
      evaluationId: z.string().min(1),
      status: z
        .enum(["PENDING", "IN_PROGRESS", "PASS", "RETRY", "EXCELLENT", "SATISFACTORY"])
        .optional(),
      notes: z.string().optional(),
      skillRatings: z
        .array(
          z.object({
            skillId: z.string().min(1),
            attemptStatus: z.enum(["NOT_ATTEMPTED", "ATTEMPTED", "SUCCEEDED"]).optional(),
            pointScore: z.number().int().optional().nullable(),
            passed: z.boolean().optional(),
          })
        )
        .optional(),
    })
  ),
});

// GET /api/programs/[id]/instances/[instanceId]/evaluations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: programId, instanceId } = await params;

    const instance = await db.programInstance.findFirst({
      where: {
        id: instanceId,
        programId,
        organizationId: session.user.organizationId,
      },
    });

    if (!instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    const evaluations = await db.evaluation.findMany({
      where: {
        programId,
        programInstanceId: instanceId,
      },
      include: {
        athlete: {
          select: { id: true, name: true, avatar: true },
        },
        coach: {
          select: { id: true, name: true },
        },
        template: {
          select: {
            id: true,
            name: true,
            scoringType: true,
            pointScaleMin: true,
            pointScaleMax: true,
            pointScalePassThreshold: true,
          },
        },
        skillRatings: {
          include: {
            skill: {
              select: { id: true, name: true, category: true },
            },
          },
        },
      },
      orderBy: { athlete: { name: "asc" } },
    });

    return NextResponse.json({ data: evaluations });
  } catch (error) {
    console.error("Error fetching instance evaluations:", error);
    return NextResponse.json({ error: "Failed to fetch evaluations" }, { status: 500 });
  }
}

// POST /api/programs/[id]/instances/[instanceId]/evaluations
// Auto-generate PENDING evaluations for registered athletes
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: programId, instanceId } = await params;

    const instance = await db.programInstance.findFirst({
      where: {
        id: instanceId,
        programId,
        organizationId: session.user.organizationId,
      },
      include: {
        registrations: {
          where: { status: "REGISTERED" },
          select: { athleteId: true },
        },
      },
    });

    if (!instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    // Find the program's assigned evaluation template
    const templateAssignment = await db.programEvaluationTemplate.findFirst({
      where: { programId },
      include: {
        template: {
          include: {
            skills: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    if (!templateAssignment) {
      return NextResponse.json(
        { error: "No evaluation template assigned to this program" },
        { status: 400 }
      );
    }

    const template = templateAssignment.template;
    const registeredAthleteIds = instance.registrations.map((r) => r.athleteId);

    if (registeredAthleteIds.length === 0) {
      return NextResponse.json({ created: 0, skipped: 0 });
    }

    // Check for existing evaluations for this instance
    const existing = await db.evaluation.findMany({
      where: {
        programId,
        programInstanceId: instanceId,
        templateId: template.id,
        athleteId: { in: registeredAthleteIds },
      },
      select: { athleteId: true },
    });
    const existingAthleteIds = new Set(existing.map((e) => e.athleteId));
    const athletesToCreate = registeredAthleteIds.filter((id) => !existingAthleteIds.has(id));

    if (athletesToCreate.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped: registeredAthleteIds.length,
      });
    }

    const createdEvaluations = await db.$transaction(async (tx) => {
      const evaluations = [];
      for (const athleteId of athletesToCreate) {
        const evaluation = await tx.evaluation.create({
          data: {
            athleteId,
            coachId: session.user.id,
            templateId: template.id,
            programId,
            programInstanceId: instanceId,
            date: instance.date,
            levelId: template.levelId || null,
            overallScore: 0,
            status: "PENDING",
            skillRatings: {
              create: template.skills.map((ts) => ({
                skillId: ts.skillId,
                attemptStatus: "NOT_ATTEMPTED",
                passed: false,
              })),
            },
          },
        });
        evaluations.push(evaluation);
      }
      return evaluations;
    });

    return NextResponse.json({
      created: createdEvaluations.length,
      skipped: existingAthleteIds.size,
    });
  } catch (error) {
    console.error("Error generating instance evaluations:", error);
    return NextResponse.json({ error: "Failed to generate evaluations" }, { status: 500 });
  }
}

// PUT /api/programs/[id]/instances/[instanceId]/evaluations
// Bulk update evaluations (save the entire grid)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: programId, instanceId } = await params;

    const instance = await db.programInstance.findFirst({
      where: {
        id: instanceId,
        programId,
        organizationId: session.user.organizationId,
      },
    });

    if (!instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    const body = await request.json();
    const { evaluations } = bulkUpdateSchema.parse(body);

    const evaluationIds = evaluations.map((e) => e.evaluationId);

    // Verify all evaluations belong to this program/instance
    const existingEvals = await db.evaluation.findMany({
      where: {
        id: { in: evaluationIds },
        programId,
        programInstanceId: instanceId,
      },
      include: {
        template: {
          select: {
            scoringType: true,
            pointScalePassThreshold: true,
          },
        },
      },
    });

    const existingMap = new Map(existingEvals.map((e) => [e.id, e]));

    const results = await db.$transaction(async (tx) => {
      const updated = [];

      for (const evalUpdate of evaluations) {
        const existing = existingMap.get(evalUpdate.evaluationId);
        if (!existing) continue;

        // Update skill ratings if provided
        if (evalUpdate.skillRatings && evalUpdate.skillRatings.length > 0) {
          for (const sr of evalUpdate.skillRatings) {
            const scoringType = existing.template?.scoringType || "PASS_FAIL";
            const passThreshold = existing.template?.pointScalePassThreshold || 7;

            const passed =
              scoringType === "POINT_SCALE"
                ? (sr.pointScore ?? 0) >= passThreshold
                : sr.attemptStatus === "SUCCEEDED";

            await tx.evaluationSkill.updateMany({
              where: {
                evaluationId: evalUpdate.evaluationId,
                skillId: sr.skillId,
              },
              data: {
                ...(sr.attemptStatus !== undefined && { attemptStatus: sr.attemptStatus }),
                ...(sr.pointScore !== undefined && { pointScore: sr.pointScore }),
                passed,
              },
            });
          }
        }

        // Calculate overall score
        const allSkillRatings = await tx.evaluationSkill.findMany({
          where: { evaluationId: evalUpdate.evaluationId },
        });

        const scoringType = existing.template?.scoringType || "PASS_FAIL";
        let overallScore = 0;
        const skillCount = allSkillRatings.length;

        if (scoringType === "POINT_SCALE") {
          const pointScores = allSkillRatings
            .map((sr) => sr.pointScore)
            .filter((s): s is number => s != null);
          if (pointScores.length > 0) {
            overallScore =
              Math.round((pointScores.reduce((a, b) => a + b, 0) / pointScores.length) * 10) / 10;
          }
        } else {
          const succeededCount = allSkillRatings.filter(
            (sr) => sr.attemptStatus === "SUCCEEDED"
          ).length;
          const attemptedCount = allSkillRatings.filter(
            (sr) => sr.attemptStatus === "ATTEMPTED"
          ).length;
          overallScore =
            skillCount > 0
              ? Math.round(((succeededCount * 10 + attemptedCount * 5) / skillCount) * 10) / 10
              : 0;
        }

        // Determine status
        const hasAnyAttempt = allSkillRatings.some((sr) => sr.attemptStatus !== "NOT_ATTEMPTED");
        let newStatus = evalUpdate.status || existing.status;
        if (!evalUpdate.status && hasAnyAttempt && existing.status === "PENDING") {
          newStatus = "IN_PROGRESS";
        }

        const updatedEval = await tx.evaluation.update({
          where: { id: evalUpdate.evaluationId },
          data: {
            status: newStatus,
            overallScore,
            ...(evalUpdate.notes !== undefined && { notes: evalUpdate.notes }),
          },
        });

        updated.push(updatedEval);
      }

      return updated;
    });

    // Check for achievements after bulk update
    for (const evalUpdate of evaluations) {
      const existing = existingMap.get(evalUpdate.evaluationId);
      if (
        existing &&
        evalUpdate.status &&
        !["PENDING", "IN_PROGRESS"].includes(evalUpdate.status)
      ) {
        try {
          await checkAndAwardAchievements(evalUpdate.evaluationId);
        } catch {
          // Non-critical: don't fail the bulk update for achievement errors
        }
      }
    }

    return NextResponse.json({ updated: results.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error bulk updating evaluations:", error);
    return NextResponse.json({ error: "Failed to update evaluations" }, { status: 500 });
  }
}
