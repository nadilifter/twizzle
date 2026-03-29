import { db } from "@/lib/db";
import { Prisma, type BillingInterval } from "@prisma/client";
import { addMonths, addYears } from "date-fns";
import { getTodayNoonUTC, normalizeToNoonUTC } from "@/lib/date-utils";
import { executeNotificationByTrigger } from "@/lib/notification-service";

export interface InvoiceMetadata {
  membershipPurchases: {
    membershipInstanceId: string;
    athleteId?: string;
    quantity: number;
  }[];
  passPurchases: {
    passId: string;
    athleteId?: string;
    billingInterval?: string;
  }[];
  programRegistrations: {
    programId?: string;
    requiredMemberships: string[];
  }[];
  competitionRegistrations: {
    competitionId: string;
    athleteId?: string;
    categoryIds: string[];
    seedMarks: Record<string, Record<string, unknown>>;
  }[];
}

interface CartItem {
  referenceId: string;
  type: string;
  athleteId?: string;
  details?: Record<string, any>;
}

const SEED_FIELD_KEYS = [
  "seedHours",
  "seedMinutes",
  "seedSeconds",
  "seedMs",
  "seedHandTimed",
  "seedDistance",
  "seedPoints",
  "seedPlacement",
] as const;

function pickSeedFields(raw: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  let hasSeed = false;
  for (const key of SEED_FIELD_KEYS) {
    if (raw[key] != null) {
      out[key] = raw[key];
      hasSeed = true;
    }
  }
  return { seedData: out, hasSeed };
}

/**
 * Process all registrations from a paid invoice.
 * Creates CompetitionEntry, InstanceRegistration, and AthleteMembership records.
 * Also ensures OrganizationAthlete links exist for each athlete being registered.
 *
 * All operations are wrapped in a transaction for atomicity — either everything
 * succeeds or nothing is persisted.
 */
export async function processInvoiceRegistrations(
  metadata: InvoiceMetadata,
  items: CartItem[],
  userId?: string | null,
  organizationId?: string | null,
) {
  const enrollmentEvents: { athleteId: string; programName: string; userId?: string }[] = [];

  await db.$transaction(async (tx) => {
    // 1. Competition registrations
    for (const reg of metadata.competitionRegistrations) {
      if (!reg.competitionId || !reg.athleteId || !reg.categoryIds?.length) continue;

      // Lock the Competition row and re-check capacity to prevent concurrent over-enrollment
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Competition" WHERE id = ${reg.competitionId} FOR UPDATE`
      );
      const comp = await tx.competition.findUnique({
        where: { id: reg.competitionId },
        select: { capacity: true, hasCapacityRestriction: true },
      });
      if (comp?.hasCapacityRestriction && comp.capacity != null) {
        const currentCount = await tx.competitionEntry.count({
          where: {
            competitionId: reg.competitionId,
            status: { notIn: ["WITHDRAWN", "REJECTED"] },
          },
        });
        if (currentCount >= comp.capacity) {
          console.warn(`Competition ${reg.competitionId} at capacity, skipping entries for athlete ${reg.athleteId}`);
          continue;
        }
      }

      for (const categoryId of reg.categoryIds) {
        const rawSeed = (reg.seedMarks?.[categoryId] || {}) as Record<string, unknown>;
        const { seedData, hasSeed } = pickSeedFields(rawSeed);

        await tx.competitionEntry.upsert({
          where: {
            competitionCategoryId_athleteId: {
              competitionCategoryId: categoryId,
              athleteId: reg.athleteId,
            },
          },
          update: {},
          create: {
            competitionId: reg.competitionId,
            competitionCategoryId: categoryId,
            athleteId: reg.athleteId,
            status: "APPROVED",
            ...seedData,
            seedMarkSubmittedAt: hasSeed ? new Date() : null,
            seedMarkStatus: hasSeed ? "APPROVED" : null,
          },
        });
      }
    }

    // Look up guardian's default payment method once for recurring charge creation
    const defaultPaymentMethod = userId
      ? await tx.paymentMethod.findFirst({
          where: { userId, isDefault: true },
          select: { id: true },
        })
      : null;

    // 2. Program registrations
    const programItems = items.filter((item) => item.type === "program");
    for (const item of programItems) {
      const instanceId = item.details?.instanceId;
      const programId = item.details?.programId || item.referenceId;
      const athleteId = item.athleteId || item.details?.athleteId;
      const isWaitlist = item.details?.waitlist === true;
      if (!athleteId) continue;

      if (instanceId) {
        let regStatus: "REGISTERED" | "WAITLISTED" = isWaitlist ? "WAITLISTED" : "REGISTERED";

        if (!isWaitlist) {
          // Re-check capacity at registration time to prevent over-enrollment
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM "ProgramInstance" WHERE id = ${instanceId} FOR UPDATE`
          );
          const inst = await tx.programInstance.findUnique({
            where: { id: instanceId },
            select: { capacity: true },
          });
          if (inst?.capacity != null) {
            const currentCount = await tx.instanceRegistration.count({
              where: { programInstanceId: instanceId, status: "REGISTERED" },
            });
            if (currentCount >= inst.capacity) {
              regStatus = "WAITLISTED";
            }
          }
        }

        await tx.instanceRegistration.upsert({
          where: {
            programInstanceId_athleteId: {
              programInstanceId: instanceId,
              athleteId,
            },
          },
          update: {},
          create: {
            programInstanceId: instanceId,
            athleteId,
            userId: userId || undefined,
            status: regStatus,
          },
        });
      } else if (programId) {
        let enrollStatus: "ACTIVE" | "WAITLISTED" = isWaitlist ? "WAITLISTED" : "ACTIVE";

        if (!isWaitlist) {
          // Re-check program-level capacity to prevent over-enrollment
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM "Program" WHERE id = ${programId} FOR UPDATE`
          );
          const prog = await tx.program.findUnique({
            where: { id: programId },
            select: { capacity: true, hasCapacityRestriction: true, waitlistEnabled: true },
          });
          if (prog?.hasCapacityRestriction && prog.capacity != null) {
            const currentEnrolled = await tx.enrollment.count({
              where: { programId, status: { not: "WAITLISTED" } },
            });
            if (currentEnrolled >= prog.capacity) {
              enrollStatus = "WAITLISTED";
            }
          }
        }

        const enrollment = await tx.enrollment.upsert({
          where: { programId_athleteId: { programId, athleteId } },
          update: {},
          create: {
            programId,
            athleteId,
            userId: userId || undefined,
            startDate: new Date(),
            status: enrollStatus,
          },
        });

        if (enrollStatus === "ACTIVE") {
          const prog = await tx.program.findUnique({
            where: { id: programId },
            select: { name: true },
          });
          enrollmentEvents.push({
            athleteId,
            programName: prog?.name ?? "Program",
            userId: userId ?? undefined,
          });
        }

        // Auto-create RecurringCharge for recurring program billing
        if (organizationId && enrollStatus === "ACTIVE") {
          const program = await tx.program.findUnique({
            where: { id: programId },
            select: { name: true, billingInterval: true, recurringPrice: true },
          });
          if (
            program &&
            program.billingInterval !== "ONE_TIME" &&
            program.billingInterval !== "SESSION" &&
            program.recurringPrice
          ) {
            const today = getTodayNoonUTC();
            const nextDate = normalizeToNoonUTC(
              program.billingInterval === "YEARLY"
                ? addYears(today, 1)
                : addMonths(today, 1)
            )!;
            await tx.recurringCharge.create({
              data: {
                organizationId,
                userId: userId ?? undefined,
                athleteId,
                description: `${program.name} – ${program.billingInterval.toLowerCase()} billing`,
                amount: program.recurringPrice,
                frequency: program.billingInterval,
                nextChargeDate: nextDate,
                paymentMethodId: defaultPaymentMethod?.id,
                status: "ACTIVE",
                enrollmentId: enrollment.id,
              },
            });
          }
        }

        if (enrollStatus === "ACTIVE") {
          const instances = await tx.programInstance.findMany({
            where: { programId, status: { not: "CANCELLED" } },
            select: { id: true },
          });
          for (const inst of instances) {
            await tx.instanceRegistration.upsert({
              where: {
                programInstanceId_athleteId: {
                  programInstanceId: inst.id,
                  athleteId,
                },
              },
              update: {},
              create: {
                programInstanceId: inst.id,
                athleteId,
                userId: userId || undefined,
                status: "REGISTERED",
              },
            });
          }
        }
      }
    }

    // 3. Membership purchases (with capacity re-check)
    for (const purchase of metadata.membershipPurchases) {
      if (!purchase.membershipInstanceId || !purchase.athleteId) continue;

      const existing = await tx.athleteMembership.findUnique({
        where: {
          athleteId_membershipInstanceId: {
            athleteId: purchase.athleteId,
            membershipInstanceId: purchase.membershipInstanceId,
          },
        },
        select: { id: true },
      });

      if (!existing) {
        // Lock the MembershipInstance row before checking capacity to
        // prevent concurrent transactions from exceeding the limit.
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "MembershipInstance" WHERE id = ${purchase.membershipInstanceId} FOR UPDATE`
        );

        const instance = await tx.membershipInstance.findUnique({
          where: { id: purchase.membershipInstanceId },
          select: {
            capacity: true,
            group: { select: { capacity: true, hasCapacityRestriction: true } },
            _count: { select: { athleteMemberships: { where: { status: "ACTIVE" } } } },
          },
        });

        if (instance?.group?.hasCapacityRestriction) {
          const effectiveCapacity = instance.capacity ?? instance.group.capacity;
          if (effectiveCapacity != null && instance._count.athleteMemberships >= effectiveCapacity) {
            console.warn(
              `Membership instance ${purchase.membershipInstanceId} is at capacity, skipping for athlete ${purchase.athleteId}`
            );
            continue;
          }
        }

        const newMembership = await tx.athleteMembership.create({
          data: {
            athleteId: purchase.athleteId,
            membershipInstanceId: purchase.membershipInstanceId,
            startDate: new Date(),
            status: "ACTIVE",
          },
        });

        // Auto-create RecurringCharge for recurring memberships
        if (organizationId && instance) {
          const fullInstance = await tx.membershipInstance.findUnique({
            where: { id: purchase.membershipInstanceId },
            select: {
              billingInterval: true,
              price: true,
              endDate: true,
              group: { select: { name: true, allowAutoRenew: true } },
            },
          });
          if (
            fullInstance &&
            fullInstance.billingInterval !== "ONE_TIME" &&
            fullInstance.billingInterval !== "SESSION" &&
            fullInstance.group.allowAutoRenew
          ) {
            const nextDate = fullInstance.endDate
              ?? normalizeToNoonUTC(fullInstance.billingInterval === "YEARLY" ? addYears(getTodayNoonUTC(), 1) : addMonths(getTodayNoonUTC(), 1))!;
            await tx.recurringCharge.create({
              data: {
                organizationId,
                userId: userId ?? undefined,
                athleteId: purchase.athleteId,
                description: `${fullInstance.group.name} – auto-renewal`,
                amount: fullInstance.price,
                frequency: fullInstance.billingInterval,
                nextChargeDate: nextDate,
                paymentMethodId: defaultPaymentMethod?.id,
                status: "ACTIVE",
                athleteMembershipId: newMembership.id,
              },
            });
          }
        }
      }
    }

    // 4. Pass purchases
    for (const purchase of (metadata.passPurchases ?? [])) {
      if (!purchase.passId || !purchase.athleteId) continue;

      const existing = await tx.athletePass.findFirst({
        where: {
          athleteId: purchase.athleteId,
          passId: purchase.passId,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      if (!existing) {
        const today = getTodayNoonUTC();
        const interval = purchase.billingInterval || "MONTHLY";
        const endDate = normalizeToNoonUTC(
          interval === "YEARLY"
            ? addYears(today, 1)
            : addMonths(today, 1)
        )!;

        const newAthletePass = await tx.athletePass.create({
          data: {
            athleteId: purchase.athleteId,
            passId: purchase.passId,
            userId: userId ?? undefined,
            startDate: today,
            endDate,
            status: "ACTIVE",
            autoRenew: true,
          },
        });

        // Auto-create RecurringCharge for recurring passes
        if (organizationId && interval !== "ONE_TIME" && interval !== "SESSION") {
          const pass = await tx.pass.findUnique({
            where: { id: purchase.passId },
            select: { name: true, price: true },
          });
          if (pass) {
            await tx.recurringCharge.create({
              data: {
                organizationId,
                userId: userId ?? undefined,
                athleteId: purchase.athleteId,
                description: `${pass.name} – auto-renewal`,
                amount: pass.price,
                frequency: interval as BillingInterval,
                nextChargeDate: endDate,
                paymentMethodId: defaultPaymentMethod?.id,
                status: "ACTIVE",
                athletePassId: newAthletePass.id,
              },
            });
          }
        }
      }
    }

    // 5. Ensure OrganizationAthlete links exist (batched)
    if (organizationId) {
      const allAthleteIds = new Set<string>();
      for (const item of items) {
        if (item.athleteId) allAthleteIds.add(item.athleteId);
        if (item.details?.athleteId) allAthleteIds.add(item.details.athleteId);
      }
      for (const reg of metadata.competitionRegistrations) {
        if (reg.athleteId) allAthleteIds.add(reg.athleteId);
      }
      for (const purchase of metadata.membershipPurchases) {
        if (purchase.athleteId) allAthleteIds.add(purchase.athleteId);
      }
      for (const purchase of (metadata.passPurchases ?? [])) {
        if (purchase.athleteId) allAthleteIds.add(purchase.athleteId);
      }

      if (allAthleteIds.size > 0) {
        // Batch-check which links already exist to avoid N upserts
        const existing = await tx.organizationAthlete.findMany({
          where: {
            organizationId,
            athleteId: { in: [...allAthleteIds] },
          },
          select: { athleteId: true },
        });
        const existingSet = new Set(existing.map((e) => e.athleteId));
        const toCreate = [...allAthleteIds].filter((id) => !existingSet.has(id));

        if (toCreate.length > 0) {
          await tx.organizationAthlete.createMany({
            data: toCreate.map((athleteId) => ({ organizationId, athleteId })),
            skipDuplicates: true,
          });
        }
      }
    }
  });

  if (organizationId && enrollmentEvents.length > 0) {
    for (const evt of enrollmentEvents) {
      try {
        await executeNotificationByTrigger({
          organizationId,
          triggerType: "PROGRAM_ENROLLMENT",
          userId: evt.userId,
          athleteId: evt.athleteId,
          context: {
            programName: evt.programName,
          },
        });
      } catch (err) {
        console.error("Failed to send enrollment notification", err);
      }
    }
  }
}
