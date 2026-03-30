import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { rolloverSingleSeason } from "@/lib/services/season-renewal";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "seasons");
    if (gate) return gate;

    const scopedDb = getScopedDb(session.user.organizationId);
    const season = await scopedDb.season.findUnique({
      where: { id: params.id },
    });

    if (!season) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    const result = await rolloverSingleSeason(season.id, session.user.organizationId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Season rollover failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rollover failed" },
      { status: 500 }
    );
  }
}
