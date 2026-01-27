import { db } from "@/lib/db";
import { addYears, addMonths } from "date-fns";

/**
 * Checks for Membership Instances that need to be renewed (created for next term).
 * Should be run daily via cron.
 */
export async function processMembershipInstanceRenewals() {
  const now = new Date();

  // Find instances where auto-renewal is due and group allows it
  const dueInstances = await db.membershipInstance.findMany({
    where: {
      autoRenewDate: {
        lte: now,
      },
      group: {
        allowAutoRenew: true,
      },
      // Ensure we haven't already processed this (simplified check: look for newer instance in group? 
      // Ideally we'd have a 'nextInstanceId' or status, but strict date logic works for MVP)
    },
    include: {
      group: true,
    },
  });

  const results = [];

  for (const instance of dueInstances) {
    // Check if a future instance already exists
    const futureInstance = await db.membershipInstance.findFirst({
      where: {
        membershipGroupId: instance.membershipGroupId,
        startDate: {
          gt: instance.startDate,
        },
      },
    });

    if (futureInstance) {
        continue; // Already exists
    }

    // Create next instance
    // Logic: If Yearly, add 1 year to start/end.
    let nextStartDate = new Date(instance.startDate);
    let nextEndDate = new Date(instance.endDate);
    let nextAutoRenewDate = instance.autoRenewDate ? new Date(instance.autoRenewDate) : undefined;

    if (instance.billingInterval === "YEARLY") {
        nextStartDate = addYears(nextStartDate, 1);
        nextEndDate = addYears(nextEndDate, 1);
        if (nextAutoRenewDate) nextAutoRenewDate = addYears(nextAutoRenewDate, 1);
    } else if (instance.billingInterval === "MONTHLY") {
        nextStartDate = addMonths(nextStartDate, 1);
        nextEndDate = addMonths(nextEndDate, 1);
        if (nextAutoRenewDate) nextAutoRenewDate = addMonths(nextAutoRenewDate, 1);
    } else {
        // Session or other - hard to predict dates automatically without more config
        continue; 
    }

    // Name update logic (e.g., FY25 -> FY26)
    // Simple heuristic: increment numbers in name
    const nextName = instance.name.replace(/\d+/, (match) => {
        const num = parseInt(match);
        return (num + 1).toString();
    });

    const newInstance = await db.membershipInstance.create({
      data: {
        membershipGroupId: instance.membershipGroupId,
        name: nextName, // e.g. "FY26"
        price: instance.price, // Keep same price
        billingInterval: instance.billingInterval,
        startDate: nextStartDate,
        endDate: nextEndDate,
        autoRenewDate: nextAutoRenewDate,
        status: "ACTIVE",
      },
    });

    results.push({
        previous: instance.name,
        new: newInstance.name,
        groupId: instance.membershipGroupId
    });
  }

  return results;
}

/**
 * Checks for Athlete Memberships that need to be renewed into the next instance.
 * Should be run daily via cron.
 */
export async function processAthleteRenewals() {
    const now = new Date();

    // Find active athlete memberships expiring soon (e.g. today or last week) with autoRenew=true
    // And where they haven't been renewed yet (no future membership in same group)
    const expiringMemberships = await db.athleteMembership.findMany({
        where: {
            endDate: {
                lte: now, // Expired or expiring today
            },
            status: "ACTIVE",
            autoRenew: true,
        },
        include: {
            instance: {
                include: {
                    group: true
                }
            },
            athlete: true
        }
    });

    const renewals = [];

    for (const membership of expiringMemberships) {
        // Find the "next" instance for this group
        // It must start after the current one ends (or close to it)
        const nextInstance = await db.membershipInstance.findFirst({
            where: {
                membershipGroupId: membership.instance.membershipGroupId,
                startDate: {
                    gte: membership.instance.endDate, // Starts after current ends
                },
                status: "ACTIVE"
            },
            orderBy: {
                startDate: 'asc'
            }
        });

        if (!nextInstance) {
            // No next instance available yet
            continue;
        }

        // Check if athlete already has membership for that instance
        const existingNext = await db.athleteMembership.findFirst({
            where: {
                athleteId: membership.athleteId,
                membershipInstanceId: nextInstance.id
            }
        });

        if (existingNext) {
            continue;
        }

        // Create renewal
        // Note: This creates the record. Payment processing would be a separate step/integration.
        const newMembership = await db.athleteMembership.create({
            data: {
                athleteId: membership.athleteId,
                membershipInstanceId: nextInstance.id,
                startDate: nextInstance.startDate,
                endDate: nextInstance.endDate,
                status: "ACTIVE", // Or PENDING_PAYMENT if we had that status
                autoRenew: true, // Carry over setting
            }
        });

        renewals.push({
            athlete: membership.athlete.name,
            from: membership.instance.name,
            to: nextInstance.name
        });
    }

    return renewals;
}
