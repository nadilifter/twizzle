import { db } from "@/lib/db";

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
  await db.$transaction(async (tx) => {
    // 1. Competition registrations
    for (const reg of metadata.competitionRegistrations) {
      if (!reg.competitionId || !reg.athleteId || !reg.categoryIds?.length) continue;

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

    // 2. Program registrations
    const programItems = items.filter((item) => item.type === "program");
    for (const item of programItems) {
      const instanceId = item.details?.instanceId;
      const programId = item.details?.programId || item.referenceId;
      const athleteId = item.athleteId || item.details?.athleteId;
      const isWaitlist = item.details?.waitlist === true;
      if (!athleteId) continue;

      if (instanceId) {
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
            status: isWaitlist ? "WAITLISTED" : "REGISTERED",
          },
        });
      } else if (programId) {
        const existing = await tx.enrollment.findFirst({
          where: { programId, athleteId, status: { in: ["ACTIVE", "WAITLISTED", "PAUSED"] } },
          select: { id: true },
        });
        if (!existing) {
          await tx.enrollment.create({
            data: {
              programId,
              athleteId,
              userId: userId || undefined,
              startDate: new Date(),
              status: isWaitlist ? "WAITLISTED" : "ACTIVE",
            },
          });
        }

        if (!isWaitlist) {
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

    // 3. Membership purchases
    for (const purchase of metadata.membershipPurchases) {
      if (!purchase.membershipInstanceId || !purchase.athleteId) continue;

      const existing = await tx.athleteMembership.findFirst({
        where: {
          athleteId: purchase.athleteId,
          membershipInstanceId: purchase.membershipInstanceId,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      if (!existing) {
        await tx.athleteMembership.create({
          data: {
            athleteId: purchase.athleteId,
            membershipInstanceId: purchase.membershipInstanceId,
            startDate: new Date(),
            status: "ACTIVE",
          },
        });
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
        const now = new Date();
        const interval = purchase.billingInterval || "MONTHLY";
        const endDate = new Date(now);
        if (interval === "YEARLY") {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
          endDate.setMonth(endDate.getMonth() + 1);
        }

        await tx.athletePass.create({
          data: {
            athleteId: purchase.athleteId,
            passId: purchase.passId,
            userId: userId ?? undefined,
            startDate: now,
            endDate,
            status: "ACTIVE",
            autoRenew: true,
          },
        });
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
}
