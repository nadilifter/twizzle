import { db } from "@/lib/db";
import { format } from "date-fns";

const ANNOUNCEMENT_LEAD_DAYS = 7;

/**
 * Generate announcements for upcoming enabled holidays across all active orgs.
 * Creates a PUBLISHED announcement 7 days before each holiday that doesn't
 * already have one. Sets `expiresAt` to the end of the holiday date so the
 * announcement auto-hides from notification feeds after the day passes.
 */
export async function generateHolidayAnnouncements(): Promise<{
  created: number;
  orgsProcessed: number;
}> {
  const now = new Date();
  const leadDate = new Date(now);
  leadDate.setUTCDate(leadDate.getUTCDate() + ANNOUNCEMENT_LEAD_DAYS);

  // Find enabled holidays coming up within the lead window that have no announcement yet
  const upcomingHolidays = await db.organizationHoliday.findMany({
    where: {
      isEnabled: true,
      announcementId: null,
      date: {
        gte: now,
        lte: leadDate,
      },
      organization: { isActive: true },
    },
    include: {
      organization: { select: { id: true, name: true } },
    },
  });

  let created = 0;
  const orgIds = new Set<string>();

  for (const holiday of upcomingHolidays) {
    orgIds.add(holiday.organizationId);

    const holidayDate = new Date(holiday.date);
    const formattedDate = format(
      new Date(holidayDate.toISOString().split("T")[0] + "T12:00:00Z"),
      "EEEE, MMMM d"
    );

    const expiresAt = new Date(
      Date.UTC(
        holidayDate.getUTCFullYear(),
        holidayDate.getUTCMonth(),
        holidayDate.getUTCDate(),
        23, 59, 59, 999
      )
    );

    const announcement = await db.announcement.create({
      data: {
        organizationId: holiday.organizationId,
        title: `Upcoming Closure: ${holiday.name}`,
        content: `<p>We will be closed on <strong>${formattedDate}</strong> in observance of <strong>${holiday.name}</strong>. Regular operations will resume the following business day.</p>`,
        targetScope: "ALL",
        status: "PUBLISHED",
        priority: "NORMAL",
        publishedAt: now,
        expiresAt,
      },
    });

    await db.organizationHoliday.update({
      where: { id: holiday.id },
      data: { announcementId: announcement.id },
    });

    created++;
  }

  return { created, orgsProcessed: orgIds.size };
}

/**
 * Archive announcements for holidays that have already passed.
 * Finds holidays with a linked PUBLISHED announcement whose date is in the past
 * and sets the announcement status to ARCHIVED.
 */
export async function archiveExpiredHolidayAnnouncements(): Promise<{
  archived: number;
}> {
  const now = new Date();

  const expiredHolidays = await db.organizationHoliday.findMany({
    where: {
      announcementId: { not: null },
      date: { lt: now },
      announcement: { status: "PUBLISHED" },
    },
    select: { announcementId: true },
  });

  if (expiredHolidays.length === 0) {
    return { archived: 0 };
  }

  const announcementIds = expiredHolidays
    .map((h) => h.announcementId)
    .filter((id): id is string => id !== null);

  const result = await db.announcement.updateMany({
    where: {
      id: { in: announcementIds },
      status: "PUBLISHED",
    },
    data: { status: "ARCHIVED" },
  });

  return { archived: result.count };
}
