import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";

void getScopedDb;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.skateCanadaSeason.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    const season = await db.$transaction(async (tx) => {
      await tx.skateCanadaSeason.updateMany({ data: { isActive: false } });
      return tx.skateCanadaSeason.update({
        where: { id },
        data: { isActive: true },
      });
    });

    return NextResponse.json(season);
  } catch (error) {
    console.error("Error activating season:", error);
    return NextResponse.json({ error: "Failed to activate season" }, { status: 500 });
  }
}
