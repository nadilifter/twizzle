import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const createAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  expiresAt: z.string().datetime().optional().nullable(),
})

// GET /api/superadmin/announcements
// List all system announcements
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    const where = {
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { content: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(status && { status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED" }),
    }

    const [announcements, total] = await Promise.all([
      db.systemAnnouncement.findMany({
        where,
        include: {
          createdBy: {
            select: { name: true, email: true },
          },
          _count: {
            select: { readBy: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.systemAnnouncement.count({ where }),
    ])

    return NextResponse.json({
      data: announcements.map((a) => ({
        ...a,
        readCount: a._count.readBy,
        _count: undefined,
      })),
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error fetching system announcements:", error)
    return NextResponse.json(
      { error: "Failed to fetch announcements" },
      { status: 500 }
    )
  }
}

// POST /api/superadmin/announcements
// Create a new system announcement
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createAnnouncementSchema.parse(body)

    const announcement = await db.systemAnnouncement.create({
      data: {
        title: validatedData.title,
        content: validatedData.content,
        priority: validatedData.priority,
        status: validatedData.status,
        publishedAt: validatedData.status === "PUBLISHED" ? new Date() : null,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
        createdById: session.user.id,
      },
    })

    return NextResponse.json(announcement)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error creating system announcement:", error)
    return NextResponse.json(
      { error: "Failed to create announcement" },
      { status: 500 }
    )
  }
}
