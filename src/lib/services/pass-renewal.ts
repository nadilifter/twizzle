import { db } from "@/lib/db";
import { addYears, addMonths } from "date-fns";

/**
 * Renews athlete passes that have expired and have autoRenew enabled.
 * Creates a new AthletePass for the next billing period.
 * Should be run daily via cron.
 */
export async function processAthletePassRenewals() {
  const now = new Date();

  const expiringPasses = await db.athletePass.findMany({
    where: {
      endDate: { lte: now },
      status: "ACTIVE",
      autoRenew: true,
      pass: {
        status: "ACTIVE",
        organization: { isActive: true },
      },
    },
    include: {
      pass: true,
      athlete: true,
    },
  });

  const renewals: Array<{ athlete: string; passName: string; newEndDate: Date }> = [];

  for (const athletePass of expiringPasses) {
    const interval = athletePass.pass.billingInterval;
    const newStart = athletePass.endDate ?? now;
    let newEnd: Date;

    if (interval === "YEARLY") {
      newEnd = addYears(newStart, 1);
    } else {
      newEnd = addMonths(newStart, 1);
    }

    await db.athletePass.update({
      where: { id: athletePass.id },
      data: {
        startDate: newStart,
        endDate: newEnd,
        status: "ACTIVE",
      },
    });

    const athleteName =
      `${athletePass.athlete.firstName || ""} ${athletePass.athlete.lastName || ""}`.trim() ||
      athletePass.athlete.name;

    renewals.push({
      athlete: athleteName,
      passName: athletePass.pass.name,
      newEndDate: newEnd,
    });
  }

  return renewals;
}

/**
 * Expires athlete passes whose end date has passed and autoRenew is false.
 * Should be run daily via cron.
 */
export async function expireAthletePasses() {
  const now = new Date();

  const result = await db.athletePass.updateMany({
    where: {
      endDate: { lt: now },
      status: "ACTIVE",
      autoRenew: false,
    },
    data: {
      status: "EXPIRED",
    },
  });

  return { expiredCount: result.count };
}
