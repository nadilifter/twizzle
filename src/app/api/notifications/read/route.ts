import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { z } from "zod";

const markReadSchema = z.object({
  announcementId: z.string().min(1, "Announcement ID is required"),
  type: z.enum(["system", "org"]),
  organizationId: z.string().optional(),
});

// POST /api/notifications/read
// Mark a single announcement as read
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { announcementId, type, organizationId } = markReadSchema.parse(body);

    if (type === "system") {
      // Mark system announcement as read
      await db.systemAnnouncementRead.upsert({
        where: {
          announcementId_userId: {
            announcementId,
            userId: session.user.id,
          },
        },
        create: {
          announcementId,
          userId: session.user.id,
        },
        update: {},
      });
    } else {
      const orgId = organizationId || session.user.organizationId;
      const announcement = orgId
        ? await getScopedDb(orgId).announcement.findFirst({
            where: { id: announcementId },
            select: { id: true },
          })
        : null;
      if (!announcement) {
        return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
      }

      await db.announcementRead.upsert({
        where: {
          announcementId_userId: {
            announcementId,
            userId: session.user.id,
          },
        },
        create: {
          announcementId,
          userId: session.user.id,
        },
        update: {},
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error marking notification as read:", error);
    return NextResponse.json({ error: "Failed to mark notification as read" }, { status: 500 });
  }
}
