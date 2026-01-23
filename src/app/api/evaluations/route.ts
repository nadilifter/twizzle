import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const skillRatingSchema = z.object({
  skillId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

const createEvaluationSchema = z.object({
  athleteId: z.string().min(1, "Athlete is required"),
  date: z.string().min(1, "Date is required"),
  level: z.string().min(1, "Level is required"),
  overallScore: z.number().min(0).max(10),
  status: z.enum(["PASS", "RETRY", "EXCELLENT", "SATISFACTORY"]),
  notes: z.string().optional(),
  skillRatings: z.array(skillRatingSchema).optional(),
});

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
    const status = searchParams.get("status");
    const level = searchParams.get("level");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = {
      athlete: {
        family: {
          organizationId: session.user.organizationId,
        },
      },
      ...(athleteId && { athleteId }),
      ...(coachId && { coachId }),
      ...(status && { status: status as "PASS" | "RETRY" | "EXCELLENT" | "SATISFACTORY" }),
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
              family: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          coach: {
            select: {
              id: true,
              name: true,
              avatar: true,
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

    // Verify athlete
    const athlete = await db.athlete.findFirst({
      where: {
        id: validatedData.athleteId,
        family: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const evaluation = await db.evaluation.create({
      data: {
        athleteId: validatedData.athleteId,
        coachId: session.user.id,
        date: new Date(validatedData.date),
        level: validatedData.level,
        overallScore: validatedData.overallScore,
        status: validatedData.status,
        notes: validatedData.notes,
        skillRatings: validatedData.skillRatings ? {
          create: validatedData.skillRatings.map((sr) => ({
            skillId: sr.skillId,
            rating: sr.rating,
            comment: sr.comment,
          })),
        } : undefined,
      },
      include: {
        athlete: true,
        coach: true,
        skillRatings: {
          include: {
            skill: true,
          },
        },
      },
    });

    // Optionally update athlete's level based on evaluation
    if (validatedData.status === "PASS" || validatedData.status === "EXCELLENT") {
      // Could update athlete level here
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
