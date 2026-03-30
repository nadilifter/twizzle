import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const sports = await db.sport.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
      },
    });

    return NextResponse.json(sports);
  } catch (error) {
    console.error("Failed to fetch sports:", error);
    return NextResponse.json({ error: "Failed to fetch sports" }, { status: 500 });
  }
}
