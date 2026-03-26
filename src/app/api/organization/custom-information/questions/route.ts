import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";

const scopeSchema = z.object({
  scopeType: z.enum([
    "ALL_PROGRAMS", "ALL_EVENTS", "ALL_COMPETITIONS", "ALL_MEMBERSHIPS", "ALL_PASSES",
    "PROGRAM", "EVENT", "COMPETITION", "MEMBERSHIP", "PASS", "SEASON",
  ]),
  targetId: z.string().nullable().optional(),
});

const createQuestionSchema = z.object({
  questionText: z.string().min(1, "Question text is required"),
  description: z.string().nullable().optional(),
  questionType: z.enum(["VALUE", "BOOLEAN", "SIGNATURE", "SHORT_TEXT", "LONG_TEXT", "IMAGE"]),
  required: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  valueMin: z.number().nullable().optional(),
  valueMax: z.number().nullable().optional(),
  allowDecimals: z.boolean().default(false),
  scopes: z.array(scopeSchema).min(1, "At least one scope is required"),
}).refine(
  (data) => {
    if (data.questionType === "VALUE") {
      return data.valueMin != null && data.valueMax != null;
    }
    return true;
  },
  { message: "Value questions require a min and max range", path: ["valueMin"] }
).refine(
  (data) => {
    if (data.questionType === "VALUE" && data.valueMin != null && data.valueMax != null) {
      return data.valueMax > data.valueMin;
    }
    return true;
  },
  { message: "Max must be greater than min", path: ["valueMax"] }
);

const updateQuestionSchema = z.object({
  id: z.string(),
  questionText: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  questionType: z.enum(["VALUE", "BOOLEAN", "SIGNATURE", "SHORT_TEXT", "LONG_TEXT", "IMAGE"]).optional(),
  required: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  valueMin: z.number().nullable().optional(),
  valueMax: z.number().nullable().optional(),
  allowDecimals: z.boolean().optional(),
  scopes: z.array(scopeSchema).min(1).optional(),
});

const reorderSchema = z.object({
  questions: z.array(z.object({
    id: z.string(),
    displayOrder: z.number().int(),
  })),
});

async function requireAdmin(session: { user: { id: string; organizationId: string; isSuperAdmin?: boolean } }) {
  if (session.user.isSuperAdmin === true) return;
  const membership = await db.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
      },
    },
  });
  if (!membership || membership.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
}

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

    const gate = await checkFeatureGate(organizationId, "customInformation");
    if (gate) return gate;

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const scopedDb = getScopedDb(organizationId);
    const questions = await scopedDb.customInfoQuestion.findMany({
      where: {
        organizationId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        scopes: true,
      },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json(questions);
  } catch (error) {
    console.error("Error fetching custom info questions:", error);
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
  }
}

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

    const gate = await checkFeatureGate(organizationId, "customInformation");
    if (gate) return gate;

    try {
      await requireAdmin(session as { user: { id: string; organizationId: string; isSuperAdmin?: boolean } });
    } catch {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createQuestionSchema.parse(body);

    const scopedDb = getScopedDb(organizationId);
    if (validatedData.displayOrder === 0) {
      const lastQuestion = await scopedDb.customInfoQuestion.findFirst({
        where: { organizationId },
        orderBy: { displayOrder: "desc" },
      });
      validatedData.displayOrder = (lastQuestion?.displayOrder ?? 0) + 1;
    }

    const question = await db.$transaction(async (tx) => {
      const q = await tx.customInfoQuestion.create({
        data: {
          organizationId,
          questionText: validatedData.questionText,
          description: validatedData.description ?? null,
          questionType: validatedData.questionType,
          required: validatedData.required,
          displayOrder: validatedData.displayOrder,
          valueMin: validatedData.questionType === "VALUE" ? validatedData.valueMin ?? null : null,
          valueMax: validatedData.questionType === "VALUE" ? validatedData.valueMax ?? null : null,
          allowDecimals: validatedData.questionType === "VALUE" ? validatedData.allowDecimals : false,
        },
      });

      if (validatedData.scopes.length > 0) {
        await tx.customInfoQuestionScope.createMany({
          data: validatedData.scopes.map((s) => ({
            questionId: q.id,
            scopeType: s.scopeType,
            targetId: s.targetId ?? null,
          })),
        });
      }

      return tx.customInfoQuestion.findUnique({
        where: { id: q.id },
        include: { scopes: true },
      });
    });

    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating custom info question:", error);
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 });
  }
}

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

    const gate = await checkFeatureGate(organizationId, "customInformation");
    if (gate) return gate;

    try {
      await requireAdmin(session as { user: { id: string; organizationId: string; isSuperAdmin?: boolean } });
    } catch {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();

    const scopedDb = getScopedDb(organizationId);

    if (body.questions && Array.isArray(body.questions)) {
      const validatedData = reorderSchema.parse(body);

      await db.$transaction(
        validatedData.questions.map((q) =>
          db.customInfoQuestion.update({
            where: { id: q.id, organizationId },
            data: { displayOrder: q.displayOrder },
          })
        )
      );

      const updatedQuestions = await scopedDb.customInfoQuestion.findMany({
        where: { organizationId, isActive: true },
        include: { scopes: true },
        orderBy: { displayOrder: "asc" },
      });

      return NextResponse.json(updatedQuestions);
    }

    const validatedData = updateQuestionSchema.parse(body);
    const { id, scopes, ...updateData } = validatedData;

    const existingQuestion = await scopedDb.customInfoQuestion.findFirst({
      where: { id, organizationId },
    });
    if (!existingQuestion) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const question = await db.$transaction(async (tx) => {
      const verified = await tx.customInfoQuestion.findFirst({
        where: { id, organizationId },
        select: { id: true },
      });
      if (!verified) throw new Error("Not found");

      await tx.customInfoQuestion.update({
        where: { id },
        data: updateData,
      });

      if (scopes) {
        await tx.customInfoQuestionScope.deleteMany({
          where: { questionId: id },
        });
        if (scopes.length > 0) {
          await tx.customInfoQuestionScope.createMany({
            data: scopes.map((s) => ({
              questionId: id,
              scopeType: s.scopeType,
              targetId: s.targetId ?? null,
            })),
          });
        }
      }

      return tx.customInfoQuestion.findUnique({
        where: { id },
        include: { scopes: true },
      });
    });

    return NextResponse.json(question);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating custom info question:", error);
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}

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

    const gate = await checkFeatureGate(organizationId, "customInformation");
    if (gate) return gate;

    try {
      await requireAdmin(session as { user: { id: string; organizationId: string; isSuperAdmin?: boolean } });
    } catch {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Question ID is required" }, { status: 400 });
    }

    const scopedDb = getScopedDb(organizationId);
    const existingQuestion = await scopedDb.customInfoQuestion.findFirst({
      where: { id, organizationId },
    });
    if (!existingQuestion) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    await scopedDb.customInfoQuestion.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting custom info question:", error);
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 });
  }
}
