import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const skillDifficultyEnum = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);

const createSkillSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  level: z.string().optional(),
  description: z.string().optional(),
  difficultyLevel: skillDifficultyEnum.optional().default("BEGINNER"),
  minAge: z.number().int().min(0).max(100).optional().nullable(),
  maxAge: z.number().int().min(0).max(100).optional().nullable(),
  videoUrl: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

// GET /api/skills
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category");
    const level = searchParams.get("level");
    const difficultyLevel = searchParams.get("difficultyLevel");
    const minAge = searchParams.get("minAge");
    const maxAge = searchParams.get("maxAge");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = {
      organizationId: session.user.organizationId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(category && { category }),
      ...(level && { level }),
      ...(difficultyLevel && { difficultyLevel: difficultyLevel as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" }),
      // Filter skills appropriate for an athlete's age
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

    const [skills, total, categories] = await Promise.all([
      db.skill.findMany({
        where,
        orderBy: [{ category: "asc" }, { difficultyLevel: "asc" }, { name: "asc" }],
        take: limit,
        skip: offset,
      }),
      db.skill.count({ where }),
      // Get unique categories for filtering
      db.skill.findMany({
        where: { organizationId: session.user.organizationId },
        select: { category: true },
        distinct: ["category"],
        orderBy: { category: "asc" },
      }),
    ]);

    // Group by category for easier UI consumption
    const grouped = skills.reduce((acc, skill) => {
      if (!acc[skill.category]) {
        acc[skill.category] = [];
      }
      acc[skill.category].push(skill);
      return acc;
    }, {} as Record<string, typeof skills>);

    return NextResponse.json({
      data: skills,
      grouped,
      categories: categories.map((c) => c.category),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching skills:", error);
    return NextResponse.json(
      { error: "Failed to fetch skills" },
      { status: 500 }
    );
  }
}

// POST /api/skills
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
    const validatedData = createSkillSchema.parse(body);

    const skill = await db.skill.create({
      data: {
        ...validatedData,
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(skill);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating skill:", error);
    return NextResponse.json(
      { error: "Failed to create skill" },
      { status: 500 }
    );
  }
}
