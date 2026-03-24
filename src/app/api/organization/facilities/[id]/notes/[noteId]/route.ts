import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import { z } from "zod";

const updateNoteSchema = z.object({
  content: z.string().min(1, "Note content is required").max(5000),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id, noteId } = await params;

    const scopedDb = getScopedDb(organizationId);

    const facility = await scopedDb.facility.findFirst({
      where: { id },
      select: { id: true },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const existingNote = await scopedDb.facilityNote.findFirst({
      where: { id: noteId, facilityId: id },
    });

    if (!existingNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (existingNote.authorId !== session.user.id) {
      return NextResponse.json({ error: "You can only edit your own notes" }, { status: 403 });
    }

    const body = await request.json();
    const { content } = updateNoteSchema.parse(body);

    const note = await scopedDb.facilityNote.update({
      where: { id: noteId },
      data: { content },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating facility note:", error);
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id, noteId } = await params;

    const scopedDb = getScopedDb(organizationId);

    const facility = await scopedDb.facility.findFirst({
      where: { id },
      select: { id: true },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const existingNote = await scopedDb.facilityNote.findFirst({
      where: { id: noteId, facilityId: id },
    });

    if (!existingNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (existingNote.authorId !== session.user.id) {
      return NextResponse.json({ error: "You can only delete your own notes" }, { status: 403 });
    }

    await scopedDb.facilityNote.delete({
      where: { id: noteId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting facility note:", error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
