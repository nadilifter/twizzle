import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { calculateAge, isAgeEligible } from "@/lib/age-utils";

/**
 * POST /api/sites/[slug]/competitions/[id]/eligibility
 *
 * Check whether a given athlete is eligible for this competition overall,
 * and return the list of eligible category IDs based on the athlete's
 * age, gender, and level.
 *
 * Body: { athleteId: string }
 * Returns: { eligible: boolean, reasons: string[], eligibleCategoryIds: string[] }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { slug, id: competitionId } = await params;
    const { athleteId } = await request.json();

    if (!athleteId) {
      return NextResponse.json(
        { error: "athleteId is required" },
        { status: 400 }
      );
    }

    // Look up site config
    const config = await db.websiteConfig.findUnique({
      where: { subdomain: slug },
      select: { organizationId: true },
    });

    if (!config) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // Fetch the competition with categories and their age category + gender restriction data
    const competition = await db.competition.findUnique({
      where: { id: competitionId },
      include: {
        categories: {
          where: { isActive: true },
          include: {
            sportEvent: { select: { id: true, name: true, code: true } },
            ageCategory: { select: { id: true, name: true, code: true, minAge: true, maxAge: true } },
            individualEntry: { select: { hasGenderRestriction: true, allowedGenders: true } },
            combinationEntry: {
              select: {
                rowValue: { select: { allowedGenders: true } },
                colValue: { select: { allowedGenders: true } },
                template: { select: { restrictionAxis: true } },
              },
            },
          },
        },
      },
    });

    if (!competition || competition.organizationId !== config.organizationId) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    }

    // Fetch the athlete with org-specific level
    const athlete = await db.athlete.findUnique({
      where: { id: athleteId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        gender: true,
        organizationAthletes: {
          where: { organizationId: config.organizationId },
          select: { level: true },
        },
        memberships: {
          where: { status: "ACTIVE" },
          select: { membershipInstanceId: true },
        },
      },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const athleteLevel = athlete.organizationAthletes[0]?.level ?? null;
    const age = calculateAge(athlete.birthDate);
    const reasons: string[] = [];

    // 1. Check competition-level age restriction
    if (competition.hasAgeRestriction) {
      if (!isAgeEligible(age, competition.minAge, competition.maxAge)) {
        const ageLabel =
          competition.minAge != null && competition.maxAge != null
            ? `ages ${competition.minAge}–${competition.maxAge}`
            : competition.minAge != null
            ? `ages ${competition.minAge}+`
            : `up to age ${competition.maxAge}`;
        reasons.push(`Athlete age (${age}) does not meet the requirement (${ageLabel})`);
      }
    }

    // 2. Check competition-level level restriction
    if (competition.hasLevelRestriction && competition.levelRequirementIds.length > 0) {
      if (!athleteLevel || !competition.levelRequirementIds.includes(athleteLevel)) {
        reasons.push("Athlete does not meet the level requirement for this competition");
      }
    }

    // 3. Check competition-level membership restriction
    let requiresMembershipPurchase = false;
    let availableMemberships: Array<{
      id: string;
      name: string;
      price: number;
      billingInterval: string;
      groupId: string;
      groupName: string;
    }> = [];

    if (competition.hasMembershipRestriction && competition.membershipRequirementIds.length > 0) {
      const activeMembershipInstanceIds = athlete.memberships.map((m) => m.membershipInstanceId);
      const hasRequired = competition.membershipRequirementIds.some((id) =>
        activeMembershipInstanceIds.includes(id)
      );

      if (!hasRequired) {
        // Athlete doesn't have the membership -- check if they can purchase one
        const now = new Date();
        const instances = await db.membershipInstance.findMany({
          where: {
            id: { in: competition.membershipRequirementIds },
            status: "ACTIVE",
          },
          include: {
            group: {
              include: {
                levelRequirements: { select: { levelId: true } },
              },
            },
          },
        });

        for (const instance of instances) {
          const group = instance.group;

          // Check purchase window
          const purchaseStart = instance.purchaseStartDate
            ?? (group.purchaseWindowDays != null
              ? new Date(instance.startDate.getTime() - group.purchaseWindowDays * 86400000)
              : new Date(0));
          const purchaseEnd = instance.purchaseEndDate ?? instance.endDate;
          if (now < purchaseStart || now > purchaseEnd) continue;

          // Check gender restriction
          if (group.hasGenderRestriction && group.allowedGenders.length > 0) {
            if (!athlete.gender || !group.allowedGenders.includes(athlete.gender)) continue;
          }

          // Check age restriction
          if (group.hasAgeRestriction) {
            if (!isAgeEligible(age, group.minAge, group.maxAge)) continue;
          }

          // Check level restriction
          if (group.hasLevelRestriction && group.levelRequirements.length > 0) {
            const allowedLevelIds = group.levelRequirements.map((lr) => lr.levelId);
            if (!athleteLevel || !allowedLevelIds.includes(athleteLevel)) continue;
          }

          availableMemberships.push({
            id: instance.id,
            name: instance.name,
            price: Number(instance.price),
            billingInterval: instance.billingInterval,
            groupId: group.id,
            groupName: group.name,
          });
        }

        if (availableMemberships.length > 0) {
          requiresMembershipPurchase = true;
        } else {
          reasons.push("Athlete does not have the required membership and is not eligible to purchase one");
        }
      }
    }

    // If not eligible at competition level, return early
    if (reasons.length > 0) {
      return NextResponse.json({
        eligible: false,
        reasons,
        eligibleCategoryIds: [],
        requiresMembershipPurchase: false,
        availableMemberships: [],
      });
    }

    // 4. Filter categories by athlete eligibility (age + gender)
    const eligibleCategoryIds: string[] = [];

    for (const category of competition.categories) {
      if (category.ageCategory) {
        if (!isAgeEligible(age, category.ageCategory.minAge, category.ageCategory.maxAge)) {
          continue;
        }
      }

      // Gender check from individual entry template
      if (category.individualEntry?.hasGenderRestriction && category.individualEntry.allowedGenders.length > 0) {
        if (!athlete.gender || !category.individualEntry.allowedGenders.includes(athlete.gender)) {
          continue;
        }
      }

      // Gender check from combination entry template (restriction axis)
      if (category.combinationEntry) {
        const axis = category.combinationEntry.template?.restrictionAxis;
        const restrictionValue = axis === "ROW" ? category.combinationEntry.rowValue : axis === "COLUMN" ? category.combinationEntry.colValue : null;
        if (restrictionValue && restrictionValue.allowedGenders.length > 0) {
          if (!athlete.gender || !restrictionValue.allowedGenders.includes(athlete.gender)) {
            continue;
          }
        }
      }

      eligibleCategoryIds.push(category.id);
    }

    return NextResponse.json({
      eligible: true,
      reasons: [],
      eligibleCategoryIds,
      requiresMembershipPurchase,
      availableMemberships,
    });
  } catch (error) {
    console.error("Competition Eligibility Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
