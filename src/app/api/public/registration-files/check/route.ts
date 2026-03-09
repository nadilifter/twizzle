import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Check if a registration file already exists for a given athlete + entity.
 * Used during registration flows to determine whether the "Files" step
 * can be auto-skipped or should show the existing file.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { athleteId, programId, competitionId, eventId } = body;

    if (!athleteId) {
      return NextResponse.json({ error: "athleteId is required" }, { status: 400 });
    }

    const entityCount = [programId, competitionId, eventId].filter(Boolean).length;
    if (entityCount !== 1) {
      return NextResponse.json(
        { error: "Exactly one of programId, competitionId, or eventId must be provided" },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { athleteId };
    if (programId) where.programId = programId;
    if (competitionId) where.competitionId = competitionId;
    if (eventId) where.eventId = eventId;

    const file = await db.registrationFile.findFirst({
      where,
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        contentType: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ exists: !!file, file: file || null });
  } catch (error) {
    console.error("Error checking registration file:", error);
    return NextResponse.json({ error: "Failed to check file" }, { status: 500 });
  }
}
