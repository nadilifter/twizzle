import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

export const getCachedSiteConfig = unstable_cache(
  async (subdomain: string) => {
    return db.websiteConfig.findUnique({
      where: { subdomain },
      select: { organizationId: true, primaryColor: true },
    });
  },
  ["site-config-program"],
  { revalidate: 30 }
);

export async function getEnrollmentCounts(programId: string, waitlistEnabled: boolean) {
  const [enrolled, waitlistedCount] = await Promise.all([
    db.enrollment.count({
      where: { programId, status: { in: ["ACTIVE", "WAITLIST_PAYMENT_PENDING"] } },
    }),
    waitlistEnabled
      ? db.enrollment.count({
          where: { programId, status: "WAITLISTED" },
        })
      : Promise.resolve(0),
  ]);
  return { enrolled, waitlistedCount };
}

export function resolveRegistrationAccess(
  program: { earlyAccessCode: string | null; registrationStatus?: string | null },
  earlyAccessCode: string | null
) {
  const programStatus = (program.registrationStatus ?? null) as
    | "OPEN"
    | "SCHEDULED"
    | "CLOSED"
    | null;
  const hasValidEarlyAccess =
    earlyAccessCode !== null &&
    program.earlyAccessCode !== null &&
    earlyAccessCode === program.earlyAccessCode;
  const canRegister = programStatus === "OPEN" || hasValidEarlyAccess;
  return { programStatus, hasValidEarlyAccess, canRegister };
}

export async function getInstanceRegistrationCounts(
  instanceIds: string[]
): Promise<Map<string, number>> {
  if (instanceIds.length === 0) return new Map();
  const rows = await db.instanceRegistration.groupBy({
    by: ["programInstanceId"],
    where: { programInstanceId: { in: instanceIds } },
    _count: true,
  });
  return new Map(rows.map((r) => [r.programInstanceId, r._count]));
}

export function serializeInstances(
  instances: Array<{
    id: string;
    date: Date;
    startTime: string;
    endTime: string;
    capacity: number | null;
    facility: { name: string; city: string | null } | null;
  }>,
  programCapacity: number | null,
  registrationCounts: Map<string, number>
) {
  return instances.map((i) => ({
    id: i.id,
    date: new Date(i.date).toISOString(),
    startTime: i.startTime,
    endTime: i.endTime,
    capacity: i.capacity || programCapacity || undefined,
    registrationCount: registrationCounts.get(i.id) ?? 0,
    facility: i.facility ? { name: i.facility.name, city: i.facility.city } : undefined,
  }));
}
