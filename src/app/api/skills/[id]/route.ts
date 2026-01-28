import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const skillDifficultyEnum = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);

const updateSkillSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  level: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  difficultyLevel: skillDifficultyEnum.optional(),
  minAge: z.number().int().min(0).max(100).optional().nullable(),
  maxAge: z.number().int().min(0).max(100).optional().nullable(),
  videoUrl: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

// GET /api/skills/[id]
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

    const skill = await db.skill.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: {
            evaluationSkills: true,
            rotationSkills: true,
            templateSkills: true,
          },
        },
      },
    });

    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    return NextResponse.json(skill);
  } catch (error) {
    console.error("Error fetching skill:", error);
    return NextResponse.json(
      { error: "Failed to fetch skill" },
      { status: 500 }
    );
  }
}

// PUT /api/skills/[id]
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

    // Check if skill exists and belongs to organization
    const existingSkill = await db.skill.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingSkill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateSkillSchema.parse(body);

    const skill = await db.skill.update({
      where: { id },
      data: validatedData,
    });

    return NextResponse.json(skill);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating skill:", error);
    return NextResponse.json(
      { error: "Failed to update skill" },
      { status: 500 }
    );
  }
}

// DELETE /api/skills/[id]
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

    // Check if skill exists and belongs to organization
    const existingSkill = await db.skill.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: {
            evaluationSkills: true,
            templateSkills: true,
          },
        },
      },
    });

    if (!existingSkill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    // Warn if skill is in use
    const inUseCount = existingSkill._count.evaluationSkills + existingSkill._count.templateSkills;
    if (inUseCount > 0) {
      return NextResponse.json(
        { 
          error: "Skill is in use",
          message: `This skill is used in ${existingSkill._count.evaluationSkills} evaluation(s) and ${existingSkill._count.templateSkills} template(s). Remove these references first.`,
        },
        { status: 409 }
      );
    }

    await db.skill.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting skill:", error);
    return NextResponse.json(
      { error: "Failed to delete skill" },
      { status: 500 }
    );
  }
}
