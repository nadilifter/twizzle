import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createMediaSchema = z.object({
  url: z.string().min(1, "URL is required"),
  type: z.enum(["IMAGE", "VIDEO"]),
  title: z.string().optional(),
  description: z.string().optional(),
  athleteId: z.string().optional(),
  eventId: z.string().optional(),
});

// GET /api/media
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");
    const eventId = searchParams.get("eventId");
    const uploadedById = searchParams.get("uploadedById");
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Ensure organizationId is present
    if (!session.user.organizationId) {
      return NextResponse.json({ data: [], total: 0, limit, offset });
    }

    const where: any = {
      organizationId: session.user.organizationId,
      ...(athleteId && { athleteId }),
      ...(eventId && { eventId }),
      ...(uploadedById && { uploadedById }),
      ...(type && { type: type as "IMAGE" | "VIDEO" }),
    };

    const [media, total] = await Promise.all([
      db.media.findMany({
        where,
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
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.media.count({ where }),
    ]);

    return NextResponse.json({
      data: media,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching media:", error);
    return NextResponse.json(
      { error: "Failed to fetch media" },
      { status: 500 }
    );
  }
}

// POST /api/media
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.organizationId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 });
    }

    const body = await request.json();
    
    let validatedData;
    try {
      validatedData = createMediaSchema.parse(body);
    } catch (zodError) {
      if (zodError instanceof z.ZodError) {
        return NextResponse.json(
          { error: zodError.errors[0]?.message || "Validation error" },
          { status: 400 }
        );
      }
      throw zodError;
    }

    // Verify athlete if provided
    if (validatedData.athleteId) {
      const athlete = await db.athlete.findFirst({
        where: {
          id: validatedData.athleteId,
          organizationId: session.user.organizationId,
        },
      });
      if (!athlete) {
        return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
      }
    }

    // Verify event if provided
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

    const media = await db.media.create({
      data: {
        url: validatedData.url,
        type: validatedData.type,
        title: validatedData.title,
        description: validatedData.description,
        athleteId: validatedData.athleteId,
        eventId: validatedData.eventId,
        uploadedById: session.user.id,
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

    return NextResponse.json(media);
  } catch (error) {
    console.error("Error creating media:", error);
    return NextResponse.json(
      { error: "Failed to create media" },
      { status: 500 }
    );
  }
}
