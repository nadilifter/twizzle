import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { z } from "zod";

const updateMediaSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  athleteId: z.string().nullable().optional(),
  eventId: z.string().nullable().optional(),
});

// GET /api/media/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const media = await db.media.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        athlete: {
          select: {
            id: true,
            name: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    return NextResponse.json(media);
  } catch (error) {
    console.error("Error fetching media:", error);
    return NextResponse.json(
      { error: "Failed to fetch media" },
      { status: 500 }
    );
  }
}

// PATCH /api/media/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify media exists and belongs to organization
    const existingMedia = await db.media.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingMedia) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    const body = await request.json();
    
    let validatedData;
    try {
      validatedData = updateMediaSchema.parse(body);
    } catch (zodError) {
      if (zodError instanceof z.ZodError) {
        return NextResponse.json(
          { error: zodError.issues[0]?.message || "Validation error" },
          { status: 400 }
        );
      }
      throw zodError;
    }

    // Verify athlete if provided and not null
    if (validatedData.athleteId) {
      const athlete = await db.athlete.findFirst({
        where: {
          id: validatedData.athleteId,
          organizationAthletes: {
            some: { organizationId: session.user.organizationId },
          },
        },
      });
      if (!athlete) {
        return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
      }
    }

    // Verify event if provided and not null
    if (validatedData.eventId) {
      const event = await db.event.findFirst({
        where: {
          id: validatedData.eventId,
          organizationId: session.user.organizationId,
        },
      });
      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }
    }

    const scopedDb = getScopedDb(session.user.organizationId);
    const media = await scopedDb.media.update({
      where: { id },
      data: {
        ...(validatedData.title !== undefined && { title: validatedData.title }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.athleteId !== undefined && { athleteId: validatedData.athleteId }),
        ...(validatedData.eventId !== undefined && { eventId: validatedData.eventId }),
      },
      include: {
        athlete: {
          select: {
            id: true,
            name: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(media);
  } catch (error) {
    console.error("Error updating media:", error);
    return NextResponse.json(
      { error: "Failed to update media" },
      { status: 500 }
    );
  }
}

// DELETE /api/media/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify media exists and belongs to organization
    const existingMedia = await db.media.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingMedia) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    const scopedDb = getScopedDb(session.user.organizationId);
    await scopedDb.media.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting media:", error);
    return NextResponse.json(
      { error: "Failed to delete media" },
      { status: 500 }
    );
  }
}
