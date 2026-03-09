import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getSignedUrl } from "@/lib/storage";
import { db } from "@/lib/db";

/**
 * GET /api/registration-files?athleteId=...
 * Lists all registration files for a given athlete.
 * Optionally filter by entityType (program|competition|event).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");

    if (!athleteId) {
      return NextResponse.json({ error: "athleteId is required" }, { status: 400 });
    }

    const where: Record<string, unknown> = { athleteId };

    const entityType = searchParams.get("entityType");
    if (entityType === "program") {
      where.programId = { not: null };
    } else if (entityType === "competition") {
      where.competitionId = { not: null };
    } else if (entityType === "event") {
      where.eventId = { not: null };
    }

    const records = await db.registrationFile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        program: { select: { id: true, name: true } },
        competition: { select: { id: true, name: true } },
        event: { select: { id: true, title: true } },
      },
    });

    const files = await Promise.all(
      records.map(async (f) => {
        let downloadUrl = f.url;
        if (f.storageKey) {
          try {
            downloadUrl = await getSignedUrl("documents", f.storageKey, 3600);
          } catch {
            // Fall back to stored URL
          }
        }
        return {
          id: f.id,
          fileName: f.fileName,
          fileSize: f.fileSize,
          contentType: f.contentType,
          downloadUrl,
          programId: f.programId,
          competitionId: f.competitionId,
          eventId: f.eventId,
          entityName: f.program?.name || f.competition?.name || (f.event as any)?.title || null,
          createdAt: f.createdAt,
        };
      })
    );

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error listing registration files:", error);
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
}
