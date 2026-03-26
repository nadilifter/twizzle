import { db } from "@/lib/db";
import { addYears, subDays } from "date-fns";
import { generateInstanceDates, calculateEndTime } from "@/lib/program-instance-utils";
import { normalizeToNoonUTC } from "@/lib/date-utils";

/**
 * Advance a date-only value by one calendar year, keeping noon UTC.
 */
function advanceDateOneYear(date: Date): Date {
  const advanced = addYears(date, 1);
  return normalizeToNoonUTC(advanced)!;
}

/**
 * Increment all runs of digits in a string by 1.
 * Falls back to appending the current year + 1 if no digits found.
 */
function incrementName(name: string): string {
  if (/\d+/.test(name)) {
    return name.replace(/\d+/g, (match) => {
      const num = parseInt(match);
      return (num + 1).toString();
    });
  }
  return `${name} ${new Date().getFullYear() + 1}`;
}

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Duplicate all programs linked to a season into a new season,
 * advancing dates by one year and generating instances from rrule.
 */
async function rolloverPrograms(
  tx: TransactionClient,
  oldSeasonId: string,
  newSeasonId: string,
  organizationId: string
) {
  const programs = await tx.program.findMany({
    where: { seasonId: oldSeasonId, organizationId },
  });

  for (const program of programs) {
    const newStartDate = program.startDate ? advanceDateOneYear(program.startDate) : null;
    const newEndDate = program.endDate ? advanceDateOneYear(program.endDate) : null;

    const newProgram = await tx.program.create({
      data: {
        organizationId,
        name: program.name,
        description: program.description,
        color: program.color,
        status: "INACTIVE",
        registrationType: program.registrationType,
        pricingModel: program.pricingModel,
        basePrice: program.basePrice,
        perSessionPrice: program.perSessionPrice,
        billingInterval: program.billingInterval,
        recurringPrice: program.recurringPrice,
        startDate: newStartDate,
        endDate: newEndDate,
        rrule: program.rrule,
        startTime: program.startTime,
        duration: program.duration,
        facilityId: program.facilityId,
        capacity: program.capacity,
        waitlistEnabled: program.waitlistEnabled,
        waitlistAutoPromote: program.waitlistAutoPromote,
        waitlistCapacity: program.waitlistCapacity,
        showCoachOnSite: program.showCoachOnSite,
        imageUrl: program.imageUrl,
        minAge: program.minAge,
        maxAge: program.maxAge,
        hasSpaceRestriction: program.hasSpaceRestriction,
        spaceCapacityMode: program.spaceCapacityMode,
        hasGenderRestriction: program.hasGenderRestriction,
        hasLevelRestriction: program.hasLevelRestriction,
        hasCapacityRestriction: program.hasCapacityRestriction,
        hasAgeRestriction: program.hasAgeRestriction,
        hasMembershipRestriction: program.hasMembershipRestriction,
        hasPassRestriction: program.hasPassRestriction,
        hasWaiverRestriction: program.hasWaiverRestriction,
        hasMedicalRequirement: program.hasMedicalRequirement,
        hasFileRequirement: program.hasFileRequirement,
        fileRequirementConfig: program.fileRequirementConfig ?? undefined,
        allowedGenders: program.allowedGenders,
        glCodeId: program.glCodeId,
        seasonId: newSeasonId,
        registrationStartDate: newStartDate,
        registrationEndDate: newEndDate,
        registrationStartTime: null,
        registrationEndTime: null,
        registrationOpen: true,
        earlyAccessCode: null,
      },
    });

    if (newStartDate && newEndDate && program.startTime && program.duration) {
      const instanceDates = generateInstanceDates(newStartDate, newEndDate, program.rrule);
      const endTime = calculateEndTime(program.startTime, program.duration);

      if (instanceDates.length > 0) {
        await tx.programInstance.createMany({
          data: instanceDates.map((date) => ({
            programId: newProgram.id,
            organizationId,
            date,
            startTime: program.startTime!,
            endTime,
            status: "SCHEDULED" as const,
          })),
        });
      }
    }
  }
}

/**
 * Duplicate all membership groups (and their instances) linked to a season
 * into a new season, advancing dates by one year.
 */
async function rolloverMemberships(
  tx: TransactionClient,
  oldSeasonId: string,
  newSeasonId: string,
  organizationId: string
) {
  const groups = await tx.membershipGroup.findMany({
    where: { seasonId: oldSeasonId, organizationId },
    include: { instances: true },
  });

  for (const group of groups) {
    const newGroup = await tx.membershipGroup.create({
      data: {
        organizationId,
        name: group.name,
        description: group.description,
        programTypes: group.programTypes,
        isRecurring: group.isRecurring,
        allowAutoRenew: group.allowAutoRenew,
        defaultPrice: group.defaultPrice,
        defaultBillingInterval: group.defaultBillingInterval,
        autoGenerateInstances: false,
        generationLeadDays: group.generationLeadDays,
        purchaseWindowDays: group.purchaseWindowDays,
        capacity: group.capacity,
        hasGenderRestriction: group.hasGenderRestriction,
        hasAgeRestriction: group.hasAgeRestriction,
        hasLevelRestriction: group.hasLevelRestriction,
        hasCapacityRestriction: group.hasCapacityRestriction,
        hasWaiverRestriction: group.hasWaiverRestriction,
        hasMedicalRequirement: group.hasMedicalRequirement,
        allowedGenders: group.allowedGenders,
        minAge: group.minAge,
        maxAge: group.maxAge,
        glCodeId: group.glCodeId,
        seasonId: newSeasonId,
      },
    });

    for (const instance of group.instances) {
      const newStartDate = advanceDateOneYear(instance.startDate);
      const newEndDate = advanceDateOneYear(instance.endDate);

      await tx.membershipInstance.create({
        data: {
          membershipGroupId: newGroup.id,
          name: incrementName(instance.name),
          price: instance.price,
          billingInterval: instance.billingInterval,
          startDate: newStartDate,
          endDate: newEndDate,
          purchaseStartDate: instance.purchaseStartDate ? advanceDateOneYear(instance.purchaseStartDate) : null,
          purchaseEndDate: instance.purchaseEndDate ? advanceDateOneYear(instance.purchaseEndDate) : null,
          registrationStartDate: newStartDate,
          registrationEndDate: newEndDate,
          registrationStartTime: null,
          registrationEndTime: null,
          registrationOpen: true,
          earlyAccessCode: null,
          capacity: instance.capacity,
          autoRenewDate: instance.autoRenewDate ? advanceDateOneYear(instance.autoRenewDate) : null,
          isAutoGenerated: true,
          status: "DRAFT",
        },
      });
    }
  }
}

/**
 * Duplicate all competitions (with categories and pricing tiers) linked to
 * a season into a new season, advancing dates by one year.
 */
async function rolloverCompetitions(
  tx: TransactionClient,
  oldSeasonId: string,
  newSeasonId: string,
  organizationId: string
) {
  const competitions = await tx.competition.findMany({
    where: { seasonId: oldSeasonId, organizationId },
    include: {
      categories: true,
      pricingTiers: true,
    },
  });

  for (const competition of competitions) {
    const newStartDate = advanceDateOneYear(competition.startDate);
    const newEndDate = advanceDateOneYear(competition.endDate);

    const newCompetition = await tx.competition.create({
      data: {
        organizationId,
        name: competition.name,
        color: competition.color,
        competitionType: competition.competitionType,
        status: "DRAFT",
        facilityId: competition.facilityId,
        country: competition.country,
        stateProvince: competition.stateProvince,
        city: competition.city,
        streetAddress: competition.streetAddress,
        postalCode: competition.postalCode,
        latitude: competition.latitude,
        longitude: competition.longitude,
        startDate: newStartDate,
        endDate: newEndDate,
        startTime: competition.startTime,
        endTime: competition.endTime,
        categoryMode: competition.categoryMode,
        hasLevelRestriction: competition.hasLevelRestriction,
        levelRequirementIds: competition.levelRequirementIds,
        hasCapacityRestriction: competition.hasCapacityRestriction,
        capacity: competition.capacity,
        hasAgeRestriction: competition.hasAgeRestriction,
        minAge: competition.minAge,
        maxAge: competition.maxAge,
        hasMembershipRestriction: competition.hasMembershipRestriction,
        membershipRequirementIds: competition.membershipRequirementIds,
        hasWaiverRestriction: competition.hasWaiverRestriction,
        waiverRequirementIds: competition.waiverRequirementIds,
        hasMedicalRequirement: competition.hasMedicalRequirement,
        hasFileRequirement: competition.hasFileRequirement,
        fileRequirementConfig: competition.fileRequirementConfig ?? undefined,
        pricingMode: competition.pricingMode,
        entryFee: competition.entryFee,
        glCodeId: competition.glCodeId,
        seasonId: newSeasonId,
        registrationStartDate: newStartDate,
        registrationEndDate: newEndDate,
        registrationStartTime: null,
        registrationEndTime: null,
        registrationOpen: true,
        earlyAccessCode: null,
        publishStatus: "DRAFT",
        scheduledGoLiveDate: null,
        scheduledGoLiveTime: null,
      },
    });

    if (competition.categories.length > 0) {
      await tx.competitionCategory.createMany({
        data: competition.categories.map((cat) => ({
          competitionId: newCompetition.id,
          combinationEntryId: cat.combinationEntryId,
          individualEntryId: cat.individualEntryId,
          sportEventId: cat.sportEventId,
          ageCategoryId: cat.ageCategoryId,
          resultType: cat.resultType,
          sortDirection: cat.sortDirection,
          precision: cat.precision,
          seedMarkRequired: cat.seedMarkRequired,
          submissionMode: cat.submissionMode,
          qualifyingMark: cat.qualifyingMark,
          isTeamEvent: cat.isTeamEvent,
          teamSize: cat.teamSize,
          price: cat.price,
          isActive: cat.isActive,
          displayOrder: cat.displayOrder,
        })),
      });
    }

    if (competition.pricingTiers.length > 0) {
      await tx.competitionPricingTier.createMany({
        data: competition.pricingTiers.map((tier) => ({
          competitionId: newCompetition.id,
          minEvents: tier.minEvents,
          maxEvents: tier.maxEvents,
          pricePerEvent: tier.pricePerEvent,
          displayOrder: tier.displayOrder,
        })),
      });
    }
  }
}

/**
 * Calculate next season dates by advancing both start and end by one year.
 */
function calculateNextSeasonDates(season: { startDate: Date; endDate: Date }) {
  const nextStartDate = advanceDateOneYear(season.startDate);
  const nextEndDate = advanceDateOneYear(season.endDate);

  return { nextStartDate, nextEndDate };
}

/**
 * Roll over a single season: create a new DRAFT season with all linked
 * programs, memberships, and competitions duplicated with dates +1 year.
 * Can be called from the cron job or manually via an API endpoint.
 */
export async function rolloverSingleSeason(
  seasonId: string,
  organizationId: string
): Promise<{ newSeasonId: string; newName: string }> {
  const season = await db.season.findFirst({
    where: { id: seasonId, organizationId },
  });

  if (!season) {
    throw new Error("Season not found");
  }

  const { nextStartDate, nextEndDate } = calculateNextSeasonDates(season);
  const nextName = incrementName(season.name);

  const newSeason = await db.$transaction(async (tx) => {
    const created = await tx.season.create({
      data: {
        organizationId: season.organizationId,
        name: nextName,
        description: season.description,
        color: season.color,
        startDate: nextStartDate,
        endDate: nextEndDate,
        status: "DRAFT",
        isRecurring: season.isRecurring,
        renewalLeadDays: season.renewalLeadDays,
        isAutoGenerated: false,
      },
    });

    await rolloverPrograms(tx, season.id, created.id, season.organizationId);
    await rolloverMemberships(tx, season.id, created.id, season.organizationId);
    await rolloverCompetitions(tx, season.id, created.id, season.organizationId);

    return created;
  }, { timeout: 30000 });

  return { newSeasonId: newSeason.id, newName: nextName };
}

/**
 * Generates upcoming seasons for recurring seasons.
 * Uses each season's renewalLeadDays to decide when to generate.
 * Creates DRAFT seasons that admins review and publish.
 * Also rolls over all linked programs, memberships, and competitions.
 * Should be run daily via cron.
 */
export async function generateUpcomingSeasons() {
  const now = new Date();

  const recurringSeasons = await db.season.findMany({
    where: {
      isRecurring: true,
      status: "ACTIVE",
      organization: { isActive: true },
    },
    orderBy: { endDate: "desc" },
  });

  const results: Array<{ seasonId: string; seasonName: string; newName: string; newSeasonId: string }> = [];

  const seen = new Set<string>();

  for (const season of recurringSeasons) {
    if (seen.has(season.organizationId + ":" + season.name)) continue;
    seen.add(season.organizationId + ":" + season.name);

    const generationThreshold = subDays(season.endDate, season.renewalLeadDays);
    if (now < generationThreshold) continue;

    const { nextStartDate, nextEndDate } = calculateNextSeasonDates(season);
    const nextName = incrementName(season.name);

    const newSeason = await db.$transaction(async (tx) => {
      const futureExists = await tx.season.findFirst({
        where: {
          organizationId: season.organizationId,
          startDate: { gt: season.startDate },
          isAutoGenerated: true,
        },
      });

      if (futureExists) return null;

      const created = await tx.season.create({
        data: {
          organizationId: season.organizationId,
          name: nextName,
          description: season.description,
          color: season.color,
          startDate: nextStartDate,
          endDate: nextEndDate,
          status: "DRAFT",
          isRecurring: true,
          renewalLeadDays: season.renewalLeadDays,
          isAutoGenerated: true,
        },
      });

      await rolloverPrograms(tx, season.id, created.id, season.organizationId);
      await rolloverMemberships(tx, season.id, created.id, season.organizationId);
      await rolloverCompetitions(tx, season.id, created.id, season.organizationId);

      return created;
    }, { timeout: 30000 });

    if (!newSeason) continue;

    results.push({
      seasonId: season.id,
      seasonName: season.name,
      newName: nextName,
      newSeasonId: newSeason.id,
    });
  }

  return results;
}

/**
 * Expires seasons past their end date.
 * Should be run daily via cron.
 */
export async function expireSeasons() {
  const now = new Date();

  const result = await db.season.updateMany({
    where: {
      endDate: { lt: now },
      status: "ACTIVE",
    },
    data: {
      status: "EXPIRED",
    },
  });

  return { expiredCount: result.count };
}
