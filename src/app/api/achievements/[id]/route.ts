import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateAchievementSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  badgeImageUrl: z.string().url().optional().nullable(),
});

// GET /api/achievements/[id]
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

    const achievement = await db.achievement.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            levelId: true,
            level: true,
            completionType: true,
            completionThreshold: true,
            skills: {
              include: {
                skill: true,
              },
              orderBy: { order: "asc" },
            },
          },
        },
        athleteAchievements: {
          include: {
            athlete: {
              select: {
                id: true,
                name: true,
                level: true,
                avatar: true,
              },
            },
          },
          orderBy: { earnedAt: "desc" },
          take: 10,
        },
        _count: {
          select: {
            athleteAchievements: true,
          },
        },
      },
    });

    if (!achievement) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    return NextResponse.json(achievement);
  } catch (error) {
    console.error("Error fetching achievement:", error);
    return NextResponse.json(
      { error: "Failed to fetch achievement" },
      { status: 500 }
    );
  }
}

// PUT /api/achievements/[id]
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

    // Check if achievement exists and belongs to organization
    const existingAchievement = await db.achievement.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingAchievement) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateAchievementSchema.parse(body);

    const achievement = await db.achievement.update({
      where: { id },
      data: validatedData,
      include: {
        template: {
          select: {
            id: true,
            name: true,
            levelId: true,
            level: true,
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
    });

    return NextResponse.json(achievement);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating achievement:", error);
    return NextResponse.json(
      { error: "Failed to update achievement" },
      { status: 500 }
    );
  }
}

// DELETE /api/achievements/[id]
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

    // Check if achievement exists and belongs to organization
    const existingAchievement = await db.achievement.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: {
            athleteAchievements: true,
          },
        },
      },
    });

    if (!existingAchievement) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    // Warn if athletes have earned this achievement
    if (existingAchievement._count.athleteAchievements > 0) {
      return NextResponse.json(
        { 
          error: "Achievement has been earned",
          message: `This achievement has been earned by ${existingAchievement._count.athleteAchievements} athlete(s). Deleting it will also remove their achievement records.`,
          requiresConfirmation: true,
        },
        { status: 409 }
      );
    }

    // Delete achievement
    await db.achievement.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting achievement:", error);
    return NextResponse.json(
      { error: "Failed to delete achievement" },
      { status: 500 }
    );
  }
}
