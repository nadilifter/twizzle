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

    // Fetch the competition with categories and their age category data
    const competition = await db.competition.findUnique({
      where: { id: competitionId },
      include: {
        categories: {
          where: { isActive: true },
          include: {
            sportEvent: { select: { id: true, name: true, code: true } },
            ageCategory: { select: { id: true, name: true, code: true, minAge: true, maxAge: true } },
          },
        },
      },
    });

    if (!competition || competition.organizationId !== config.organizationId) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    }

    // Fetch the athlete
    const athlete = await db.athlete.findUnique({
      where: { id: athleteId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        gender: true,
        level: true,
        memberships: {
          where: { status: "ACTIVE" },
          select: { membershipInstanceId: true },
        },
      },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

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
      if (!athlete.level || !competition.levelRequirementIds.includes(athlete.level)) {
        reasons.push("Athlete does not meet the level requirement for this competition");
      }
    }

    // 3. Check competition-level membership restriction
    if (competition.hasMembershipRestriction && competition.membershipRequirementIds.length > 0) {
      const activeMembershipInstanceIds = athlete.memberships.map((m) => m.membershipInstanceId);
      const hasRequired = competition.membershipRequirementIds.some((id) =>
        activeMembershipInstanceIds.includes(id)
      );
      if (!hasRequired) {
        reasons.push("Athlete does not have the required membership for this competition");
      }
    }

    // If not eligible at competition level, return early
    if (reasons.length > 0) {
      return NextResponse.json({
        eligible: false,
        reasons,
        eligibleCategoryIds: [],
      });
    }

    // 4. Filter categories by athlete eligibility (age category match)
    const eligibleCategoryIds: string[] = [];

    for (const category of competition.categories) {
      // Check age category eligibility
      if (category.ageCategory) {
        if (!isAgeEligible(age, category.ageCategory.minAge, category.ageCategory.maxAge)) {
          continue;
        }
      }

      eligibleCategoryIds.push(category.id);
    }

    return NextResponse.json({
      eligible: true,
      reasons: [],
      eligibleCategoryIds,
    });
  } catch (error) {
    console.error("Competition Eligibility Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
