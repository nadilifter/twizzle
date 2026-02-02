import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/notifications
// Fetches combined system and organization announcements for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get("organizationId")

    const now = new Date()

    // Fetch system announcements (available to all authenticated users)
    const systemAnnouncementsPromise = db.systemAnnouncement.findMany({
      where: {
        status: "PUBLISHED",
        // publishedAt must exist and be in the past (or now)
        publishedAt: { not: null, lte: now },
        // Either no expiry or not yet expired
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        readBy: session?.user?.id
          ? {
              where: { userId: session.user.id },
              select: { readAt: true },
            }
          : false,
      },
      orderBy: { publishedAt: "desc" },
      take: 50,
    })

    // Fetch organization announcements if user has an organization context
    const effectiveOrgId = organizationId || session?.user?.organizationId
    
    const orgAnnouncementsPromise = effectiveOrgId
      ? db.announcement.findMany({
          where: {
            organizationId: effectiveOrgId,
            status: "PUBLISHED",
            // publishedAt must exist and be in the past (or now)
            publishedAt: { not: null, lte: now },
            // Either no expiry or not yet expired
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          include: {
            organization: {
              select: { name: true },
            },
            readBy: session?.user?.id
              ? {
                  where: { userId: session.user.id },
                  select: { readAt: true },
                }
              : false,
          },
          orderBy: { publishedAt: "desc" },
          take: 50,
        })
      : Promise.resolve([])

    const [systemAnnouncements, orgAnnouncements] = await Promise.all([
      systemAnnouncementsPromise,
      orgAnnouncementsPromise,
    ])

    // Transform and combine announcements
    const announcements = [
      ...systemAnnouncements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        priority: a.priority,
        type: "system" as const,
        isRead: Array.isArray(a.readBy) && a.readBy.length > 0,
        publishedAt: a.publishedAt?.toISOString() || a.createdAt.toISOString(),
      })),
      ...orgAnnouncements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        priority: a.priority,
        type: "org" as const,
        isRead: Array.isArray(a.readBy) && a.readBy.length > 0,
        publishedAt: a.publishedAt?.toISOString() || a.createdAt.toISOString(),
        organizationName: a.organization.name,
      })),
    ]

    // Sort by priority (URGENT > HIGH > NORMAL > LOW), then by date
    const priorityOrder = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 }
    announcements.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })

    const unreadCount = announcements.filter((a) => !a.isRead).length

    return NextResponse.json({
      announcements,
      unreadCount,
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    )
  }
}
