import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  targetScope: z.enum(["ALL", "PROGRAM", "EVENT", "FAMILY"]).default("ALL"),
  targetProgramId: z.string().optional().nullable(),
  targetEventId: z.string().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});

// GET /api/announcements
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const targetScope = searchParams.get("targetScope");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = {
      organizationId: session.user.organizationId,
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { content: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(status && { status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED" }),
      ...(targetScope && { targetScope: targetScope as "ALL" | "PROGRAM" | "EVENT" | "FAMILY" }),
    };

    const [announcements, total] = await Promise.all([
      db.announcement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.announcement.count({ where }),
    ]);

    return NextResponse.json({
      data: announcements,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return NextResponse.json(
      { error: "Failed to fetch announcements" },
      { status: 500 }
    );
  }
}

// POST /api/announcements
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("communication.send")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createAnnouncementSchema.parse(body);

    // Validate target references
    if (validatedData.targetScope === "PROGRAM" && validatedData.targetProgramId) {
      const program = await db.program.findFirst({
        where: {
          id: validatedData.targetProgramId,
          organizationId: session.user.organizationId,
        },
      });
      if (!program) {
        return NextResponse.json({ error: "Program not found" }, { status: 404 });
      }
    }

    if (validatedData.targetScope === "EVENT" && validatedData.targetEventId) {
      const event = await db.event.findFirst({
        where: {
          id: validatedData.targetEventId,
          organizationId: session.user.organizationId,
        },
      });
      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }
    }

    const announcement = await db.announcement.create({
      data: {
        title: validatedData.title,
        content: validatedData.content,
        targetScope: validatedData.targetScope,
        targetProgramId: validatedData.targetProgramId,
        targetEventId: validatedData.targetEventId,
        priority: validatedData.priority,
        status: validatedData.status,
        publishedAt: validatedData.status === "PUBLISHED" ? new Date() : null,
        organizationId: session.user.organizationId,
      },
    });

    // TODO: If status is PUBLISHED, send notifications to targeted families
    // This would integrate with email/SMS services

    return NextResponse.json(announcement);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating announcement:", error);
    return NextResponse.json(
      { error: "Failed to create announcement" },
      { status: 500 }
    );
  }
}
