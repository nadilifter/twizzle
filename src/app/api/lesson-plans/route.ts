import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";
import { z } from "zod";

const createLessonPlanSchema = z.object({
  name: z.string().min(1, "Name is required"),
  programId: z.string().min(1, "Program is required"),
  date: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).default("DRAFT"),
  theme: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/lesson-plans
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const programId = searchParams.get("programId");
    const status = searchParams.get("status");
    const authorId = searchParams.get("authorId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = {
      organizationId: session.user.organizationId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { theme: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(programId && { programId }),
      ...(status && { status: status as "ACTIVE" | "DRAFT" | "ARCHIVED" }),
      ...(authorId && { authorId }),
    };

    const [lessonPlans, total] = await Promise.all([
      db.lessonPlan.findMany({
        where,
        include: {
          program: {
            select: {
              id: true,
              name: true,
            },
          },
          author: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.lessonPlan.count({ where }),
    ]);

    return NextResponse.json({
      data: lessonPlans,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching lesson plans:", error);
    return NextResponse.json({ error: "Failed to fetch lesson plans" }, { status: 500 });
  }
}

// POST /api/lesson-plans
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
    const validatedData = createLessonPlanSchema.parse(body);

    // Verify program
    const program = await db.program.findFirst({
      where: {
        id: validatedData.programId,
        organizationId: session.user.organizationId,
      },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const lessonPlan = await db.lessonPlan.create({
      data: {
        name: validatedData.name,
        programId: validatedData.programId,
        date: validatedData.date ? parseDateOnly(validatedData.date) : null,
        authorId: session.user.id,
        status: validatedData.status,
        theme: validatedData.theme,
        notes: validatedData.notes,
        organizationId: session.user.organizationId,
      },
      include: {
        program: true,
        author: true,
      },
    });

    return NextResponse.json(lessonPlan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating lesson plan:", error);
    return NextResponse.json({ error: "Failed to create lesson plan" }, { status: 500 });
  }
}
