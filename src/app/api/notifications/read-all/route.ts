import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/notifications/read-all
// Mark all announcements as read for the current user
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    const now = new Date();

    // Get all unread system announcements
    const systemAnnouncements = await db.systemAnnouncement.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        readBy: {
          none: { userId: session.user.id },
        },
      },
      select: { id: true },
    });

    // Get all unread org announcements
    const orgAnnouncements = organizationId
      ? await db.announcement.findMany({
          where: {
            organizationId,
            status: "PUBLISHED",
            publishedAt: { lte: now },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            readBy: {
              none: { userId: session.user.id },
            },
          },
          select: { id: true },
        })
      : [];

    // Create read records for all unread announcements
    await Promise.all([
      // System announcements
      ...systemAnnouncements.map((a) =>
        db.systemAnnouncementRead.upsert({
          where: {
            announcementId_userId: {
              announcementId: a.id,
              userId: session.user.id,
            },
          },
          create: {
            announcementId: a.id,
            userId: session.user.id,
          },
          update: {},
        })
      ),
      // Org announcements
      ...orgAnnouncements.map((a) =>
        db.announcementRead.upsert({
          where: {
            announcementId_userId: {
              announcementId: a.id,
              userId: session.user.id,
            },
          },
          create: {
            announcementId: a.id,
            userId: session.user.id,
          },
          update: {},
        })
      ),
    ]);

    return NextResponse.json({
      success: true,
      markedRead: systemAnnouncements.length + orgAnnouncements.length,
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return NextResponse.json(
      { error: "Failed to mark all notifications as read" },
      { status: 500 }
    );
  }
}
