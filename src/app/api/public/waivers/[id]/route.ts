import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/public/waivers/[id]?organizationId=xxx
// Public endpoint - fetch waiver content for signing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { error: "Waiver not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: waiver.id,
      title: waiver.title,
      pages: waiver.pages,
    });
  } catch (error) {
    console.error("Error fetching public waiver:", error);
    return NextResponse.json(
      { error: "Failed to fetch waiver" },
      { status: 500 }
    );
  }
}
