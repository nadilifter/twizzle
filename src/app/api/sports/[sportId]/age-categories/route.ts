import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/sports/[sportId]/age-categories
 * Returns all age categories for the sport.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sportId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sportId } = await params;

    const sport = await db.sport.findUnique({
      where: { id: sportId },
      select: { id: true, name: true, slug: true },
    });
    if (!sport) {
      return NextResponse.json({ error: "Sport not found" }, { status: 404 });
    }

    const ageCategories = await db.sportAgeCategory.findMany({
      where: { sportId },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({ sport, ageCategories });
  } catch (error) {
    console.error("Error fetching sport age categories:", error);
    return NextResponse.json({ error: "Failed to fetch age categories" }, { status: 500 });
  }
}
