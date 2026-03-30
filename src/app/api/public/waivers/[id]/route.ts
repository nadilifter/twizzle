import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolvePublicRequest } from "@/lib/public-api";

// GET /api/public/waivers/[id]?organizationId=xxx
// Public endpoint - fetch waiver content for signing
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const result = await resolvePublicRequest(request, searchParams.get("organizationId"));
    if (result instanceof NextResponse) return result;
    const { organizationId } = result;

    const waiver = await db.waiver.findFirst({
      where: {
        id,
        organizationId,
        status: "ACTIVE",
      },
      include: {
        pages: {
          orderBy: { pageNumber: "asc" },
          select: {
            id: true,
            pageNumber: true,
            title: true,
            content: true,
          },
        },
      },
    });

    if (!waiver) {
      return NextResponse.json({ error: "Waiver not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: waiver.id,
      title: waiver.title,
      pages: waiver.pages,
    });
  } catch (error) {
    console.error("Error fetching public waiver:", error);
    return NextResponse.json({ error: "Failed to fetch waiver" }, { status: 500 });
  }
}
