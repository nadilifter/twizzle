import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const skillDifficultyEnum = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);

const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  difficultyLevel: skillDifficultyEnum.optional().default("BEGINNER"),
  minAge: z.number().int().min(0).max(100).optional().nullable(),
  maxAge: z.number().int().min(0).max(100).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  skillIds: z.array(z.string()).min(1, "At least one skill is required"),
});

// GET /api/evaluation-templates
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const difficultyLevel = searchParams.get("difficultyLevel");
    const isActive = searchParams.get("isActive");
    const minAge = searchParams.get("minAge");
    const maxAge = searchParams.get("maxAge");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = {
      organizationId: session.user.organizationId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(difficultyLevel && { difficultyLevel: difficultyLevel as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" }),
      ...(isActive !== null && isActive !== undefined && { isActive: isActive === "true" }),
      // Filter templates appropriate for an athlete's age
      ...(minAge && {
        OR: [
          { minAge: null },
          { minAge: { lte: parseInt(minAge) } },
        ],
      }),
      ...(maxAge && {
        OR: [
          { maxAge: null },
          { maxAge: { gte: parseInt(maxAge) } },
        ],
      }),
    };

    const [templates, total] = await Promise.all([
      db.evaluationTemplate.findMany({
        where,
        include: {
          skills: {
            include: {
              skill: true,
            },
            orderBy: { order: "asc" },
          },
          _count: {
            select: {
              evaluations: true,
            },
          },
        },
        orderBy: [{ difficultyLevel: "asc" }, { name: "asc" }],
        take: limit,
        skip: offset,
      }),
      db.evaluationTemplate.count({ where }),
    ]);

    return NextResponse.json({
      data: templates,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching evaluation templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch evaluation templates" },
      { status: 500 }
    );
  }
}

// POST /api/evaluation-templates
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
    const validatedData = createTemplateSchema.parse(body);

    // Verify all skills exist and belong to organization
    const skills = await db.skill.findMany({
      where: {
        id: { in: validatedData.skillIds },
        organizationId: session.user.organizationId,
      },
    });

    if (skills.length !== validatedData.skillIds.length) {
      return NextResponse.json(
        { error: "One or more skills not found" },
        { status: 400 }
      );
    }

    const { skillIds, ...templateData } = validatedData;

    const template = await db.evaluationTemplate.create({
      data: {
        ...templateData,
        organizationId: session.user.organizationId,
        skills: {
          create: skillIds.map((skillId, index) => ({
            skillId,
            order: index,
            isRequired: true,
          })),
        },
      },
      include: {
        skills: {
          include: {
            skill: true,
          },
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            evaluations: true,
          },
        },
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating evaluation template:", error);
    return NextResponse.json(
      { error: "Failed to create evaluation template" },
      { status: 500 }
    );
  }
}
