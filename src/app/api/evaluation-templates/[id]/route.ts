import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const skillDifficultyEnum = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  difficultyLevel: skillDifficultyEnum.optional(),
  minAge: z.number().int().min(0).max(100).optional().nullable(),
  maxAge: z.number().int().min(0).max(100).optional().nullable(),
  isActive: z.boolean().optional(),
  skillIds: z.array(z.string()).min(1).optional(),
});

// GET /api/evaluation-templates/[id]
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

    const template = await db.evaluationTemplate.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
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

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error fetching evaluation template:", error);
    return NextResponse.json(
      { error: "Failed to fetch evaluation template" },
      { status: 500 }
    );
  }
}

// PUT /api/evaluation-templates/[id]
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

    // Check if template exists and belongs to organization
    const existingTemplate = await db.evaluationTemplate.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateTemplateSchema.parse(body);

    const { skillIds, ...templateData } = validatedData;

    // If skillIds provided, verify all skills exist
    if (skillIds) {
      const skills = await db.skill.findMany({
        where: {
          id: { in: skillIds },
          organizationId: session.user.organizationId,
        },
      });

      if (skills.length !== skillIds.length) {
        return NextResponse.json(
          { error: "One or more skills not found" },
          { status: 400 }
        );
      }
    }

    // Update template and skills in a transaction
    const template = await db.$transaction(async (tx) => {
      // Update template fields
      await tx.evaluationTemplate.update({
        where: { id },
        data: templateData,
      });

      // If skillIds provided, replace all skills
      if (skillIds) {
        // Delete existing skill associations
        await tx.evaluationTemplateSkill.deleteMany({
          where: { templateId: id },
        });

        // Create new skill associations
        await tx.evaluationTemplateSkill.createMany({
          data: skillIds.map((skillId, index) => ({
            templateId: id,
            skillId,
            order: index,
            isRequired: true,
          })),
        });
      }

      // Fetch and return updated template
      return tx.evaluationTemplate.findUnique({
        where: { id },
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
    });

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating evaluation template:", error);
    return NextResponse.json(
      { error: "Failed to update evaluation template" },
      { status: 500 }
    );
  }
}

// DELETE /api/evaluation-templates/[id]
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

    // Check if template exists and belongs to organization
    const existingTemplate = await db.evaluationTemplate.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: {
            evaluations: true,
          },
        },
      },
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Warn if template is in use
    if (existingTemplate._count.evaluations > 0) {
      return NextResponse.json(
        { 
          error: "Template is in use",
          message: `This template is used in ${existingTemplate._count.evaluations} evaluation(s). You can deactivate the template instead of deleting it.`,
        },
        { status: 409 }
      );
    }

    // Delete template (cascade will delete skill associations)
    await db.evaluationTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting evaluation template:", error);
    return NextResponse.json(
      { error: "Failed to delete evaluation template" },
      { status: 500 }
    );
  }
}
