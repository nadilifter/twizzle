import { db } from "@/lib/db";

export interface InvoiceMetadata {
  membershipPurchases: {
    membershipInstanceId: string;
    athleteId?: string;
    quantity: number;
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
 *
 * Can be called directly with the metadata object (for $0 checkout) or
 * by parsing invoice.notes (for webhook-based flows).
 */
export async function processInvoiceRegistrations(
  metadata: InvoiceMetadata,
  familyId: string,
  items: CartItem[]
) {
  // 1. Competition registrations
  for (const reg of metadata.competitionRegistrations) {
    if (!reg.competitionId || !reg.athleteId || !reg.categoryIds?.length) continue;

    for (const categoryId of reg.categoryIds) {
      const rawSeed = (reg.seedMarks?.[categoryId] || {}) as Record<string, unknown>;
      const { seedData, hasSeed } = pickSeedFields(rawSeed);

      await db.competitionEntry.upsert({
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

  // 2. Program registrations (InstanceRegistration)
  const programItems = items.filter((item) => item.type === "program");
  for (const item of programItems) {
    const instanceId = item.details?.instanceId || item.referenceId;
    const athleteId = item.athleteId || item.details?.athleteId;
    if (!instanceId || !athleteId) continue;

    await db.instanceRegistration.upsert({
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
        familyId,
        status: "REGISTERED",
      },
    });
  }

  // 3. Membership purchases (AthleteMembership)
  for (const purchase of metadata.membershipPurchases) {
    if (!purchase.membershipInstanceId || !purchase.athleteId) continue;

    const existing = await db.athleteMembership.findFirst({
      where: {
        athleteId: purchase.athleteId,
        membershipInstanceId: purchase.membershipInstanceId,
        status: "ACTIVE",
      },
    });

    if (!existing) {
      await db.athleteMembership.create({
        data: {
          athleteId: purchase.athleteId,
          membershipInstanceId: purchase.membershipInstanceId,
          startDate: new Date(),
          status: "ACTIVE",
        },
      });
    }
  }
}
