import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createAchievementSchema = z.object({
  templateId: z.string().min(1, "Template ID is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  badgeImageUrl: z.string().url().optional().nullable(),
});

// GET /api/achievements
// List all achievements for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const templateId = searchParams.get("templateId");
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
      ...(templateId && { templateId }),
    };

    const [achievements, total] = await Promise.all([
      db.achievement.findMany({
        where,
        include: {
          template: {
            select: {
              id: true,
              name: true,
              difficultyLevel: true,
              completionType: true,
              completionThreshold: true,
            },
          },
          _count: {
            select: {
              athleteAchievements: true,
            },
          },
        },
        orderBy: [{ template: { name: "asc" } }, { name: "asc" }],
        take: limit,
        skip: offset,
      }),
      db.achievement.count({ where }),
    ]);

    return NextResponse.json({
      data: achievements,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching achievements:", error);
    return NextResponse.json(
      { error: "Failed to fetch achievements" },
      { status: 500 }
    );
  }
}

// POST /api/achievements
// Create a new achievement for a template
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
    const validatedData = createAchievementSchema.parse(body);

    // Verify template exists and belongs to organization
    const template = await db.evaluationTemplate.findFirst({
      where: {
        id: validatedData.templateId,
        organizationId: session.user.organizationId,
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const achievement = await db.achievement.create({
      data: {
        templateId: validatedData.templateId,
        name: validatedData.name,
        description: validatedData.description,
        badgeImageUrl: validatedData.badgeImageUrl,
        organizationId: session.user.organizationId,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            difficultyLevel: true,
            completionType: true,
            completionThreshold: true,
          },
        },
      },
    });

    return NextResponse.json(achievement);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating achievement:", error);
    return NextResponse.json(
      { error: "Failed to create achievement" },
      { status: 500 }
    );
  }
}
