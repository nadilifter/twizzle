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

/**
 * Convert structured seed mark fields into a single Decimal value.
 * Time marks are converted to total seconds.
 */
function toSeedMarkDecimal(fields: Record<string, unknown>): number | null {
  if (fields.seedDistance != null) return Number(fields.seedDistance);
  if (fields.seedPoints != null) return Number(fields.seedPoints);

  // Time-based: convert to total seconds (with ms precision)
  const h = Number(fields.seedHours || 0);
  const m = Number(fields.seedMinutes || 0);
  const s = Number(fields.seedSeconds || 0);
  const ms = Number(fields.seedMs || 0);
  if (h || m || s || ms) {
    return h * 3600 + m * 60 + s + ms / 1000;
  }

  return null;
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
      const seedFields = (reg.seedMarks?.[categoryId] || {}) as Record<string, unknown>;
      const seedMark = toSeedMarkDecimal(seedFields);
      const hasSeed = seedMark != null;

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
          seedMark: seedMark,
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
