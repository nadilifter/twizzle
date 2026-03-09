import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getSignedUrl, deleteFile } from "@/lib/storage";
import { unlink } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const file = await db.registrationFile.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    let downloadUrl = file.url;
    if (file.storageKey) {
      downloadUrl = await getSignedUrl("documents", file.storageKey, 3600);
    }

    return NextResponse.json({
      id: file.id,
      fileName: file.fileName,
      fileSize: file.fileSize,
      contentType: file.contentType,
      downloadUrl,
      programId: file.programId,
      competitionId: file.competitionId,
      eventId: file.eventId,
      athleteId: file.athleteId,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching registration file:", error);
    return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const file = await db.registrationFile.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete from storage
    if (file.storageKey) {
      try {
        await deleteFile("documents", file.storageKey);
      } catch {
        // Best-effort cleanup
      }
    } else if (file.url.startsWith("/uploads/")) {
      try {
        await unlink(path.join(process.cwd(), "public", file.url));
      } catch {
        // Best-effort cleanup
      }
    }

    await db.registrationFile.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting registration file:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
