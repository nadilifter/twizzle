/**
 * Shared loader for both /css-export/validate and /css-export endpoints.
 *
 * Returns the trimmed CssExportInput the pure builder expects, or null if
 * the competition is not visible to the caller's org.
 */

import type { PrismaClient } from "@prisma/client";
import type { CssExportInput, CssExportEntry } from "@/lib/css-export";

export async function fetchCssExportInput(
  db: PrismaClient,
  competitionId: string,
  organizationId: string
): Promise<CssExportInput | null> {
  const competition = await db.competition.findFirst({
    where: { id: competitionId, organizationId },
    select: {
      id: true,
      name: true,
      startDate: true,
      organization: {
        select: {
          name: true,
          federationSection: true,
          stateProvince: true,
          country: true,
        },
      },
      entries: {
        include: {
          athlete: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              birthDate: true,
              gender: true,
              organizationAthletes: {
                where: { organizationId },
                select: {
                  federationMemberNumber: true,
                  federationMemberExpiresAt: true,
                },
              },
            },
          },
          category: {
            select: {
              id: true,
              combinationEntry: {
                select: {
                  rowValue: { select: { name: true } },
                  colValue: { select: { name: true } },
                },
              },
              individualEntry: { select: { name: true } },
              sportEvent: { select: { name: true, code: true } },
              ageCategory: { select: { name: true, code: true } },
            },
          },
        },
      },
    },
  });
  if (!competition) return null;

  const entries: CssExportEntry[] = competition.entries.map((entry) => {
    const oa = entry.athlete.organizationAthletes[0];
    const ageCat =
      entry.category.combinationEntry?.rowValue?.name ?? entry.category.ageCategory?.name ?? null;
    const disc =
      entry.category.combinationEntry?.colValue?.name ??
      entry.category.sportEvent?.name ??
      entry.category.individualEntry?.name ??
      null;
    const code = entry.category.sportEvent?.code ?? entry.category.ageCategory?.code ?? null;

    return {
      id: entry.id,
      status: entry.status,
      athlete: {
        id: entry.athlete.id,
        firstName: entry.athlete.firstName,
        lastName: entry.athlete.lastName,
        birthDate: entry.athlete.birthDate,
        gender: entry.athlete.gender,
        country: null,
        federationMemberNumber: oa?.federationMemberNumber ?? null,
        federationMemberExpiresAt: oa?.federationMemberExpiresAt ?? null,
      },
      category: {
        id: entry.category.id,
        disciplineName: disc,
        ageCategoryName: ageCat,
        code,
      },
    };
  });

  return {
    competition: {
      id: competition.id,
      name: competition.name,
      startDate: competition.startDate,
    },
    organization: competition.organization,
    entries,
  };
}
