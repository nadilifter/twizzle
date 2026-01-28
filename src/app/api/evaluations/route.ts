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
  attemptStatus: skillAttemptStatusEnum.optional().default("NOT_ATTEMPTED"),
  comment: z.string().optional(),
});

const createEvaluationSchema = z.object({
  athleteId: z.string().min(1, "Athlete is required"),
  templateId: z.string().optional(), // Optional - can create from template
  date: z.string().min(1, "Date is required"),
  level: z.string().optional(), // Optional if using template
  overallScore: z.number().min(0).max(10).optional().default(0),
  status: evaluationStatusEnum.optional().default("PENDING"),
  notes: z.string().optional(),
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

// GET /api/evaluations
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");
    const coachId = searchParams.get("coachId");
    const templateId = searchParams.get("templateId");
    const status = searchParams.get("status");
    const level = searchParams.get("level");
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
      ...(status && { status: status as "PENDING" | "IN_PROGRESS" | "PASS" | "RETRY" | "EXCELLENT" | "SATISFACTORY" }),
      ...(level && { level }),
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
              difficultyLevel: true,
            },
          },
          skillRatings: {
            include: {
              skill: true,
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

    // If template provided, load template skills
    let templateSkillIds: string[] = [];
    let level = validatedData.level;
    
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
      
      // Use template's difficulty level if level not provided
      if (!level) {
        level = template.difficultyLevel;
      }
    }

    // Determine skill ratings to create
    let skillRatingsToCreate = validatedData.skillRatings || [];
    
    // If using template and no skillRatings provided, create entries for all template skills
    if (validatedData.templateId && templateSkillIds.length > 0 && skillRatingsToCreate.length === 0) {
      skillRatingsToCreate = templateSkillIds.map((skillId) => ({
        skillId,
        attemptStatus: "NOT_ATTEMPTED" as const,
      }));
    }

    const evaluation = await db.evaluation.create({
      data: {
        athleteId: validatedData.athleteId,
        coachId: session.user.id,
        templateId: validatedData.templateId,
        date: new Date(validatedData.date),
        level: level || athlete.level,
        overallScore: validatedData.overallScore || 0,
        status: validatedData.status || "PENDING",
        notes: validatedData.notes,
        skillRatings: skillRatingsToCreate.length > 0 ? {
          create: skillRatingsToCreate.map((sr) => ({
            skillId: sr.skillId,
            rating: sr.rating,
            attemptStatus: sr.attemptStatus || "NOT_ATTEMPTED",
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
        template: true,
        skillRatings: {
          include: {
            skill: true,
          },
        },
      },
    });

    // Update athlete skill progress for each skill rating (only if not PENDING)
    if (validatedData.status && validatedData.status !== "PENDING") {
      for (const sr of skillRatingsToCreate) {
        if (sr.attemptStatus && sr.attemptStatus !== "NOT_ATTEMPTED") {
          await updateAthleteSkillProgress(
            validatedData.athleteId,
            sr.skillId,
            sr.attemptStatus,
            evaluation.id,
            new Date(validatedData.date)
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
    console.error("Error creating evaluation:", error);
    return NextResponse.json(
      { error: "Failed to create evaluation" },
      { status: 500 }
    );
  }
}
