import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const assignTemplateSchema = z.object({
  templateId: z.string().min(1, "Template ID is required"),
  isRequired: z.boolean().optional().default(false),
  dueDate: z.string().datetime().optional().nullable(),
});

const updateAssignmentSchema = z.object({
  isRequired: z.boolean().optional(),
  dueDate: z.string().datetime().optional().nullable(),
});

// GET /api/programs/[id]/evaluation-templates
// List all evaluation templates assigned to a program
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

    // Get all template assignments for this program
    const assignments = await db.programEvaluationTemplate.findMany({
      where: { programId },
      include: {
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
            _count: {
              select: {
                evaluations: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      programId,
      programName: program.name,
      templates: assignments,
    });
  } catch (error) {
    console.error("Error fetching program templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch program templates" },
      { status: 500 }
    );
  }
}

// POST /api/programs/[id]/evaluation-templates
// Assign an evaluation template to a program
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
      !session.user.permissions.includes("programs.update")
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
    const validatedData = assignTemplateSchema.parse(body);

    // Verify template exists and belongs to organization
    const template = await db.evaluationTemplate.findFirst({
      where: {
        id: validatedData.templateId,
        organizationId: session.user.organizationId,
        isActive: true,
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Check if already assigned
    const existingAssignment = await db.programEvaluationTemplate.findUnique({
      where: {
        programId_templateId: {
          programId,
          templateId: validatedData.templateId,
        },
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: "Template is already assigned to this program" },
        { status: 409 }
      );
    }

    // Create the assignment
    const assignment = await db.programEvaluationTemplate.create({
      data: {
        programId,
        templateId: validatedData.templateId,
        isRequired: validatedData.isRequired,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
      },
      include: {
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
      },
    });

    return NextResponse.json(assignment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error assigning template to program:", error);
    return NextResponse.json(
      { error: "Failed to assign template to program" },
      { status: 500 }
    );
  }
}

// DELETE /api/programs/[id]/evaluation-templates
// Remove a template assignment from a program (uses query param templateId)
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
      !session.user.permissions.includes("programs.update")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: programId } = await params;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get("templateId");

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId query parameter is required" },
        { status: 400 }
      );
    }

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

    // Check if assignment exists
    const assignment = await db.programEvaluationTemplate.findUnique({
      where: {
        programId_templateId: {
          programId,
          templateId,
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Template is not assigned to this program" },
        { status: 404 }
      );
    }

    // Delete the assignment
    await db.programEvaluationTemplate.delete({
      where: {
        programId_templateId: {
          programId,
          templateId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing template from program:", error);
    return NextResponse.json(
      { error: "Failed to remove template from program" },
      { status: 500 }
    );
  }
}

// PATCH /api/programs/[id]/evaluation-templates
// Update a template assignment (uses query param templateId)
export async function PATCH(
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
      !session.user.permissions.includes("programs.update")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: programId } = await params;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get("templateId");

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId query parameter is required" },
        { status: 400 }
      );
    }

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
    const validatedData = updateAssignmentSchema.parse(body);

    // Check if assignment exists
    const existingAssignment = await db.programEvaluationTemplate.findUnique({
      where: {
        programId_templateId: {
          programId,
          templateId,
        },
      },
    });

    if (!existingAssignment) {
      return NextResponse.json(
        { error: "Template is not assigned to this program" },
        { status: 404 }
      );
    }

    // Update the assignment
    const assignment = await db.programEvaluationTemplate.update({
      where: {
        programId_templateId: {
          programId,
          templateId,
        },
      },
      data: {
        ...(validatedData.isRequired !== undefined && {
          isRequired: validatedData.isRequired,
        }),
        ...(validatedData.dueDate !== undefined && {
          dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        }),
      },
      include: {
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
      },
    });

    return NextResponse.json(assignment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating template assignment:", error);
    return NextResponse.json(
      { error: "Failed to update template assignment" },
      { status: 500 }
    );
  }
}
