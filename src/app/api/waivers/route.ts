import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb, db } from "@/lib/db";
import { z } from "zod";

const createWaiverSchema = z.object({
  title: z.string().min(1, "Title is required"),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  pages: z.array(z.object({
    pageNumber: z.number().int().min(1),
    title: z.string().optional(),
    content: z.string().min(1, "Page content is required"),
  })).min(1, "At least one page is required"),
});

// GET /api/waivers - List all organization waivers
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const scopedDb = getScopedDb(session.user.organizationId);

    const where = {
      ...(status && { status: status as "DRAFT" | "ACTIVE" | "ARCHIVED" }),
    };

    const waivers = await scopedDb.waiver.findMany({
      where,
      include: {
        pages: {
          orderBy: { pageNumber: "asc" as const },
        },
        _count: {
          select: {
            signatures: true,
            acceptances: true,
            pages: true,
          },
        },
      },
      orderBy: { createdAt: "desc" as const },
    });

    return NextResponse.json({ data: waivers });
  } catch (error) {
    console.error("Error fetching waivers:", error);
    return NextResponse.json(
      { error: "Failed to fetch waivers" },
      { status: 500 }
    );
  }
}

// POST /api/waivers - Create a new waiver with pages
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("forms.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createWaiverSchema.parse(body);

    const waiver = await db.$transaction(async (tx) => {
      const newWaiver = await tx.waiver.create({
        data: {
          title: validatedData.title,
          status: validatedData.status,
          organizationId: session.user.organizationId,
        },
      });

      // Create pages
      await tx.waiverPage.createMany({
        data: validatedData.pages.map((page) => ({
          waiverId: newWaiver.id,
          pageNumber: page.pageNumber,
          title: page.title,
          content: page.content,
        })),
      });

      return tx.waiver.findUnique({
        where: { id: newWaiver.id },
        include: {
          pages: {
            orderBy: { pageNumber: "asc" },
          },
          _count: {
            select: {
              signatures: true,
              acceptances: true,
              pages: true,
            },
          },
        },
      });
    });

    return NextResponse.json(waiver, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating waiver:", error);
    return NextResponse.json(
      { error: "Failed to create waiver" },
      { status: 500 }
    );
  }
}
