import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createQuestionSchema = z.object({
  questionText: z.string().min(1, "Question text is required"),
  questionType: z.enum(["TEXT", "YES_NO", "MULTIPLE_CHOICE", "CHECKBOX"]).default("TEXT"),
  options: z.array(z.string()).optional().nullable(),
  required: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
});

const updateQuestionSchema = z.object({
  id: z.string(),
  questionText: z.string().min(1).optional(),
  questionType: z.enum(["TEXT", "YES_NO", "MULTIPLE_CHOICE", "CHECKBOX"]).optional(),
  options: z.array(z.string()).optional().nullable(),
  required: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const reorderSchema = z.object({
  questions: z.array(z.object({
    id: z.string(),
    displayOrder: z.number().int(),
  })),
});

// GET /api/organization/medical-questions
// Returns all custom medical questions for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const questions = await db.customMedicalQuestion.findMany({
      where: {
        organizationId: organizationId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: {
        displayOrder: "asc",
      },
    });

    return NextResponse.json(questions);
  } catch (error) {
    console.error("Error fetching medical questions:", error);
    return NextResponse.json({ error: "Failed to fetch medical questions" }, { status: 500 });
  }
}

// POST /api/organization/medical-questions
// Create a new custom medical question
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // Super admins bypass permission checks
    const isSuperAdmin = session.user.isSuperAdmin === true;
    
    if (!isSuperAdmin) {
      // Check if user has admin permissions
      const membership = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: organizationId,
            userId: session.user.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const body = await request.json();
    const validatedData = createQuestionSchema.parse(body);

    // Get the next display order if not specified
    if (validatedData.displayOrder === 0) {
      const lastQuestion = await db.customMedicalQuestion.findFirst({
        where: { organizationId },
        orderBy: { displayOrder: "desc" },
      });
      validatedData.displayOrder = (lastQuestion?.displayOrder ?? 0) + 1;
    }

    const question = await db.customMedicalQuestion.create({
      data: {
        organizationId: organizationId,
        questionText: validatedData.questionText,
        questionType: validatedData.questionType,
        options: validatedData.options ?? undefined,
        required: validatedData.required,
        displayOrder: validatedData.displayOrder,
      },
    });

    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating medical question:", error);
    return NextResponse.json({ error: "Failed to create medical question" }, { status: 500 });
  }
}

// PATCH /api/organization/medical-questions
// Update a custom medical question or reorder questions
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // Super admins bypass permission checks
    const isSuperAdmin = session.user.isSuperAdmin === true;
    
    if (!isSuperAdmin) {
      // Check if user has admin permissions
      const membership = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: organizationId,
            userId: session.user.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const body = await request.json();

    // Check if this is a reorder request
    if (body.questions && Array.isArray(body.questions)) {
      const validatedData = reorderSchema.parse(body);
      
      // Update all questions in a transaction
      await db.$transaction(
        validatedData.questions.map((q) =>
          db.customMedicalQuestion.update({
            where: { 
              id: q.id,
              organizationId: organizationId, // Ensure question belongs to org
            },
            data: { displayOrder: q.displayOrder },
          })
        )
      );

      const updatedQuestions = await db.customMedicalQuestion.findMany({
        where: { organizationId, isActive: true },
        orderBy: { displayOrder: "asc" },
      });

      return NextResponse.json(updatedQuestions);
    }

    // Single question update
    const validatedData = updateQuestionSchema.parse(body);
    const { id, ...updateData } = validatedData;

    // Verify question belongs to organization
    const existingQuestion = await db.customMedicalQuestion.findFirst({
      where: { id, organizationId },
    });

    if (!existingQuestion) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const question = await db.customMedicalQuestion.update({
      where: { id },
      data: {
        ...updateData,
        options: updateData.options ?? undefined,
      },
    });

    return NextResponse.json(question);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating medical question:", error);
    return NextResponse.json({ error: "Failed to update medical question" }, { status: 500 });
  }
}

// DELETE /api/organization/medical-questions?id=xxx
// Soft delete (deactivate) a custom medical question
export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // Super admins bypass permission checks
    const isSuperAdmin = session.user.isSuperAdmin === true;
    
    if (!isSuperAdmin) {
      // Check if user has admin permissions
      const membership = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: organizationId,
            userId: session.user.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Question ID is required" }, { status: 400 });
    }

    // Verify question belongs to organization
    const existingQuestion = await db.customMedicalQuestion.findFirst({
      where: { id, organizationId },
    });

    if (!existingQuestion) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Soft delete - set isActive to false
    await db.customMedicalQuestion.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting medical question:", error);
    return NextResponse.json({ error: "Failed to delete medical question" }, { status: 500 });
  }
}
