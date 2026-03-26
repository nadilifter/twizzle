import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolvePublicRequest } from "@/lib/public-api";

/**
 * GET /api/public/categories?organizationId=xxx
 *
 * Public endpoint returning categories with counts of associated
 * programs, events, and competitions for the marketing site.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await resolvePublicRequest(request, searchParams.get("organizationId"));
    if (result instanceof NextResponse) return result;
    const { organizationId } = result;

    const categories = await db.category.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: {
            programs: { where: { status: "ACTIVE" } },
            events: true,
            competitions: true,
          },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error("Error fetching public categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
