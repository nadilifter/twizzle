import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const generateEvaluationsSchema = z.object({
  templateId: z.string().min(1, "Template ID is required"),
  athleteIds: z.array(z.string()).optional(), // If not provided, generate for all enrolled athletes
  date: z.string().datetime().optional(), // Defaults to today
});

// GET /api/programs/[id]/evaluations
// List all evaluations for a program
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: programId } = await params;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get("templateId");
    const status = searchParams.get("status");
    const athleteId = searchParams.get("athleteId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Verify program exists and belongs to organization
    const program = await db.program.findFirst({
      where: {
        id: programId,
        organizationId: session.user.organizationId,
      },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const where = {
      programId,
      ...(templateId && { templateId }),
      ...(status && { status: status as "PENDING" | "IN_PROGRESS" | "PASS" | "RETRY" | "EXCELLENT" | "SATISFACTORY" }),
      ...(athleteId && { athleteId }),
    };

    const [evaluations, total] = await Promise.all([
      db.evaluation.findMany({
        where,
        include: {
          athlete: {
            select: {
              id: true,
              name: true,
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
            },
          },
          level: true,
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
    console.error("Error fetching program evaluations:", error);
    return NextResponse.json(
      { error: "Failed to fetch program evaluations" },
      { status: 500 }
    );
  }
}

// POST /api/programs/[id]/evaluations/generate
// Generate evaluation instances for enrolled athletes
export async function POST(
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
      !session.user.permissions.includes("training.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: programId } = await params;

    // Verify program exists and belongs to organization
    const program = await db.program.findFirst({
      where: {
        id: programId,
        organizationId: session.user.organizationId,
      },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = generateEvaluationsSchema.parse(body);

    // Verify template exists and is assigned to this program
    const templateAssignment = await db.programEvaluationTemplate.findUnique({
      where: {
        programId_templateId: {
          programId,
          templateId: validatedData.templateId,
        },
      },
      include: {
        template: {
          include: {
            skills: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!templateAssignment) {
      return NextResponse.json(
        { error: "Template is not assigned to this program" },
        { status: 400 }
      );
    }

    const template = templateAssignment.template;

    // Get athletes - either specified ones or all enrolled
    let athleteIds = validatedData.athleteIds;
    
    if (!athleteIds || athleteIds.length === 0) {
      // Get all actively enrolled athletes
      const enrollments = await db.enrollment.findMany({
        where: {
          programId,
          status: "ACTIVE",
        },
        select: { athleteId: true },
      });
      athleteIds = enrollments.map((e) => e.athleteId);
    } else {
      // Verify specified athletes are enrolled in the program
      const enrollments = await db.enrollment.findMany({
        where: {
          programId,
          athleteId: { in: athleteIds },
          status: "ACTIVE",
        },
        select: { athleteId: true },
      });
      const enrolledAthleteIds = new Set(enrollments.map((e) => e.athleteId));
      const notEnrolled = athleteIds.filter((id) => !enrolledAthleteIds.has(id));
      
      if (notEnrolled.length > 0) {
        return NextResponse.json(
          { error: `Some athletes are not enrolled in this program: ${notEnrolled.join(", ")}` },
          { status: 400 }
        );
      }
    }

    if (athleteIds.length === 0) {
      return NextResponse.json(
        { error: "No athletes to generate evaluations for" },
        { status: 400 }
      );
    }

    // Check for existing pending evaluations to avoid duplicates
    const existingEvaluations = await db.evaluation.findMany({
      where: {
        programId,
        templateId: validatedData.templateId,
        athleteId: { in: athleteIds },
        status: "PENDING",
      },
      select: { athleteId: true },
    });
    const existingAthleteIds = new Set(existingEvaluations.map((e) => e.athleteId));
    
    // Filter out athletes who already have pending evaluations
    const athletesToCreate = athleteIds.filter((id) => !existingAthleteIds.has(id));

    if (athletesToCreate.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped: athleteIds.length,
        message: "All athletes already have pending evaluations for this template",
      });
    }

    const evaluationDate = validatedData.date ? new Date(validatedData.date) : new Date();

    // Create evaluations in a transaction
    const createdEvaluations = await db.$transaction(async (tx) => {
      const evaluations = [];

      for (const athleteId of athletesToCreate) {
        const evaluation = await tx.evaluation.create({
          data: {
            athleteId,
            coachId: session.user.id,
            templateId: validatedData.templateId,
            programId,
            date: evaluationDate,
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
          include: {
            athlete: {
              select: {
                id: true,
                name: true,
              },
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
      evaluations: createdEvaluations,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error generating evaluations:", error);
    return NextResponse.json(
      { error: "Failed to generate evaluations" },
      { status: 500 }
    );
  }
}
