import { db } from "@/lib/db";
import { sendTemplatedEmail } from "@/lib/email";
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

const BATCH_SIZE = 50;

/**
 * Send reminder emails to org admins for upcoming holidays that haven't
 * been emailed about yet. Runs daily at 12:00 UTC.
 *
 * Processes holidays in batches of {@link BATCH_SIZE}. Each holiday is marked
 * via `reminderEmailSentAt` immediately after its email succeeds, so progress
 * is committed per-item. If the function times out mid-batch, the next cron
 * run re-queries only unmarked holidays and picks up where it left off.
 */
export async function sendHolidayReminderEmails(): Promise<{
  sent: number;
  failed: number;
  orgsProcessed: number;
}> {
  const now = new Date();
  const leadDate = new Date(now);
  leadDate.setUTCDate(leadDate.getUTCDate() + ANNOUNCEMENT_LEAD_DAYS);

  let sent = 0;
  let failed = 0;
  const orgIds = new Set<string>();

  const baseWhere = {
    isEnabled: true,
    reminderEmailSentAt: null,
    date: { gte: now, lte: leadDate },
    organization: { isActive: true },
  };

  // Re-query each iteration so only unprocessed holidays remain.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await db.organizationHoliday.findMany({
      where: baseWhere,
      include: {
        organization: { select: { id: true, name: true } },
      },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    // Batch-fetch admin emails for all orgs in this chunk (eliminates N+1)
    const batchOrgIds = [...new Set(batch.map((h) => h.organizationId))];
    const adminMembers = await db.organizationMember.findMany({
      where: {
        organizationId: { in: batchOrgIds },
        role: { in: ["ADMIN"] },
        status: "ACTIVE",
      },
      include: { user: { select: { email: true } } },
    });

    const adminEmailsByOrg = new Map<string, string[]>();
    for (const member of adminMembers) {
      if (!member.user.email) continue;
      const emails = adminEmailsByOrg.get(member.organizationId) ?? [];
      emails.push(member.user.email);
      adminEmailsByOrg.set(member.organizationId, emails);
    }

    for (const holiday of batch) {
      const adminEmails = adminEmailsByOrg.get(holiday.organizationId);

      if (!adminEmails || adminEmails.length === 0) {
        // No admins — mark so this holiday doesn't block future batches
        await db.organizationHoliday.update({
          where: { id: holiday.id },
          data: { reminderEmailSentAt: now },
        });
        continue;
      }

      try {
        const holidayDate = new Date(holiday.date);
        const formattedDate = format(
          new Date(holidayDate.toISOString().split("T")[0] + "T12:00:00Z"),
          "EEEE, MMMM d"
        );

        await sendTemplatedEmail("holiday-reminder", adminEmails, {
          holidayName: holiday.name,
          holidayDate: formattedDate,
          organizationName: holiday.organization.name,
        });

        await db.organizationHoliday.update({
          where: { id: holiday.id },
          data: { reminderEmailSentAt: now },
        });

        orgIds.add(holiday.organizationId);
        sent++;
      } catch (err) {
        console.error(
          `Failed to send holiday reminder for "${holiday.name}" (org ${holiday.organizationId}):`,
          err
        );
        failed++;
      }
    }
  }

  return { sent, failed, orgsProcessed: orgIds.size };
}
