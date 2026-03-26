import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

// GET /api/categories
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const scopedDb = getScopedDb(session.user.organizationId);

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const categories = await scopedDb.category.findMany({
      where,
      include: {
        _count: {
          select: {
            programs: true,
            events: true,
            competitions: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

// POST /api/categories
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

    const scopedDb = getScopedDb(session.user.organizationId);
    const body = await request.json();
    const validatedData = createCategorySchema.parse(body);

    const category = await scopedDb.category.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        imageUrl: validatedData.imageUrl,
        organizationId: session.user.organizationId!,
      },
      include: {
        _count: {
          select: {
            programs: true,
            events: true,
            competitions: true,
          },
        },
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
