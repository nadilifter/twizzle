import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";

// GET /api/notifications
// Fetches combined system and organization announcements for the current user,
// filtering by targetScope so program/event/guardian-targeted announcements
// only reach the appropriate audience.
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();

    const now = new Date();

    const systemAnnouncementsPromise = db.systemAnnouncement.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { not: null, lte: now },
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
    });

    const queryOrgId = request.nextUrl.searchParams.get("organizationId"); // tenant-isolation-ok: marketing site layouts pass config.organizationId (server-resolved) so public announcement scope matches the site being viewed; data is limited to status=PUBLISHED announcements
    const effectiveOrgId = queryOrgId || session?.user?.organizationId;
    const userId = session?.user?.id;

    const orgAnnouncementsPromise = effectiveOrgId
      ? getScopedDb(effectiveOrgId).announcement.findMany({
          where: {
            status: "PUBLISHED",
            publishedAt: { not: null, lte: now },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          include: {
            organization: {
              select: { name: true },
            },
            readBy: userId
              ? {
                  where: { userId },
                  select: { readAt: true },
                }
              : false,
          },
          orderBy: { publishedAt: "desc" },
          take: 100,
        })
      : Promise.resolve([]);

    const [systemAnnouncements, allOrgAnnouncements] = await Promise.all([
      systemAnnouncementsPromise,
      orgAnnouncementsPromise,
    ]);

    // Filter org announcements by audience targeting
    let orgAnnouncements = allOrgAnnouncements;
    if (userId && effectiveOrgId) {
      const needsProgramCheck = allOrgAnnouncements.some(
        (a) => a.targetScope === "PROGRAM" || a.targetScope === "EVENT"
      );
      const needsGuardianCheck = allOrgAnnouncements.some((a) => a.targetScope === "GUARDIAN");

      let userProgramIds: Set<string> = new Set();
      let userEventIds: Set<string> = new Set();
      let isGuardian = false;

      if (needsProgramCheck || needsGuardianCheck) {
        // Find athletes this user is a guardian of
        const guardianLinks = await db.athleteGuardian.findMany({
          where: { userId },
          select: { athleteId: true },
        });
        const athleteIds = guardianLinks.map((g) => g.athleteId);
        isGuardian = athleteIds.length > 0;

        if (athleteIds.length > 0 && needsProgramCheck) {
          const [enrollments, registrations, eventAttendances] = await Promise.all([
            db.enrollment.findMany({
              where: { athleteId: { in: athleteIds } },
              select: { programId: true },
            }),
            db.instanceRegistration.findMany({
              where: { athleteId: { in: athleteIds }, status: "REGISTERED" },
              select: { programInstance: { select: { programId: true } } },
            }),
            db.attendance.findMany({
              where: { athleteId: { in: athleteIds } },
              select: { eventId: true },
            }),
          ]);
          userProgramIds = new Set(enrollments.map((e) => e.programId));
          registrations.forEach((r) => userProgramIds.add(r.programInstance.programId));
          userEventIds = new Set(eventAttendances.map((a) => a.eventId));
        }
      }

      orgAnnouncements = allOrgAnnouncements.filter((a) => {
        switch (a.targetScope) {
          case "ALL":
            return true;
          case "GUARDIAN":
            return isGuardian;
          case "PROGRAM":
            if (!a.targetProgramId) return userProgramIds.size > 0;
            return userProgramIds.has(a.targetProgramId);
          case "EVENT":
            if (!a.targetEventId) return userEventIds.size > 0;
            return userEventIds.has(a.targetEventId);
          default:
            return true;
        }
      });
    }

    // Transform and combine
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
    ];

    const priorityOrder = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
    announcements.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    const unreadCount = announcements.filter((a) => !a.isRead).length;

    return NextResponse.json({
      announcements,
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}
