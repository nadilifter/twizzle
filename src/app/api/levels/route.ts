import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";

const createLevelSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional().nullable(),
  isDefault: z.boolean().optional(),
});

// GET /api/levels - List all levels for the organization
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

    const trainingBlocked = await checkFeatureGate(organizationId, "training");
    if (trainingBlocked) return trainingBlocked;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    const levels = await db.level.findMany({
      where: {
        organizationId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      include: {
        _count: {
          select: {
            skills: true,
          },
        },
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(levels);
  } catch (error) {
    console.error("Error fetching levels:", error);
    return NextResponse.json({ error: "Failed to fetch levels" }, { status: 500 });
  }
}

// POST /api/levels - Create a new level
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

    // Check permissions
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("programs.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createLevelSchema.parse(body);

    // If this is the first level or marked as default, handle isDefault logic
    if (validatedData.isDefault) {
      // Unset any existing default
      await db.level.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Get the highest order number to place new level at the end if not specified
    const highestOrder = await db.level.findFirst({
      where: { organizationId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const level = await db.level.create({
      data: {
        organizationId,
        name: validatedData.name,
        description: validatedData.description,
        order: validatedData.order ?? (highestOrder?.order ?? 0) + 1,
        color: validatedData.color,
        isDefault: validatedData.isDefault ?? false,
      },
      include: {
        _count: {
          select: {
            skills: true,
          },
        },
      },
    });

    return NextResponse.json(level, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating level:", error);
    return NextResponse.json({ error: "Failed to create level" }, { status: 500 });
  }
}
