import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { resolvePublicRequest } from "@/lib/public-api";
import { calculateAge, isAgeEligible } from "@/lib/age-utils";

async function verifyGuardian(athleteId: string, email: string): Promise<boolean> {
  const guardian = await db.athleteGuardian.findFirst({
    where: { athleteId, user: { email } },
    select: { id: true },
  });
  return !!guardian;
}

/**
 * POST /api/public/memberships/eligibility
 *
 * Given an athlete and a list of membership instance IDs, returns which
 * memberships the athlete is eligible to purchase and why not for others.
 *
 * Body: { athleteId: string, membershipInstanceIds: string[], organizationId: string }
 * Returns: { memberships: Array<{ id: string, eligible: boolean, reason?: string }> }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { athleteId, membershipInstanceIds } = body;

    if (!athleteId || !membershipInstanceIds?.length) {
      return NextResponse.json(
        { error: "athleteId and membershipInstanceIds are required" },
        { status: 400 }
      );
    }

    const orgResult = await resolvePublicRequest(request, body.organizationId);
    if (orgResult instanceof NextResponse) return orgResult;
    const { organizationId } = orgResult;

    const hasAccess = await verifyGuardian(athleteId, session.user.email);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const athlete = await db.athlete.findUnique({
      where: { id: athleteId },
      select: {
        id: true,
        gender: true,
        birthDate: true,
        organizationAthletes: {
          where: { organizationId },
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
    const activeMembershipIds = new Set(athlete.memberships.map((m) => m.membershipInstanceId));

    const instances = await db.membershipInstance.findMany({
      where: { id: { in: membershipInstanceIds } },
      include: {
        group: {
          include: {
            levelRequirements: { select: { levelId: true } },
          },
        },
        _count: { select: { athleteMemberships: { where: { status: "ACTIVE" } } } },
      },
    });

    const now = new Date();
    const results: Array<{ id: string; eligible: boolean; reason?: string }> = [];

    for (const instanceId of membershipInstanceIds) {
      const instance = instances.find((i) => i.id === instanceId);

      if (!instance) {
        results.push({ id: instanceId, eligible: false, reason: "Membership not found" });
        continue;
      }

      if (instance.group.organizationId !== organizationId) {
        results.push({ id: instanceId, eligible: false, reason: "Membership not available" });
        continue;
      }

      if (instance.status !== "ACTIVE") {
        results.push({
          id: instanceId,
          eligible: false,
          reason: "Membership is not currently available",
        });
        continue;
      }

      // Already has this membership
      if (activeMembershipIds.has(instanceId)) {
        results.push({ id: instanceId, eligible: true });
        continue;
      }

      const group = instance.group;

      // Purchase window
      const purchaseStart =
        instance.purchaseStartDate ??
        (group.purchaseWindowDays != null
          ? new Date(instance.startDate.getTime() - group.purchaseWindowDays * 86400000)
          : new Date(0));
      const purchaseEnd = instance.purchaseEndDate ?? instance.endDate;
      if (now < purchaseStart || now > purchaseEnd) {
        results.push({ id: instanceId, eligible: false, reason: "Not within purchase window" });
        continue;
      }

      // Capacity
      if (group.hasCapacityRestriction) {
        const effectiveCapacity = instance.capacity ?? group.capacity;
        if (effectiveCapacity != null && instance._count.athleteMemberships >= effectiveCapacity) {
          results.push({ id: instanceId, eligible: false, reason: "Membership is at capacity" });
          continue;
        }
      }

      // Gender restriction
      if (group.hasGenderRestriction && group.allowedGenders.length > 0) {
        if (!athlete.gender || !group.allowedGenders.includes(athlete.gender)) {
          const allowed = group.allowedGenders
            .map((g: string) => g.charAt(0) + g.slice(1).toLowerCase())
            .join(", ");
          results.push({
            id: instanceId,
            eligible: false,
            reason: `Gender requirement not met (${allowed})`,
          });
          continue;
        }
      }

      // Age restriction
      if (group.hasAgeRestriction) {
        if (!isAgeEligible(age, group.minAge, group.maxAge)) {
          const ageLabel =
            group.minAge != null && group.maxAge != null
              ? `ages ${group.minAge}–${group.maxAge}`
              : group.minAge != null
                ? `ages ${group.minAge}+`
                : `up to age ${group.maxAge}`;
          results.push({
            id: instanceId,
            eligible: false,
            reason: `Age requirement not met (${ageLabel})`,
          });
          continue;
        }
      }

      // Level restriction
      if (group.hasLevelRestriction && group.levelRequirements.length > 0) {
        const allowedLevelIds = group.levelRequirements.map((lr) => lr.levelId);
        if (!athleteLevel || !allowedLevelIds.includes(athleteLevel)) {
          results.push({
            id: instanceId,
            eligible: false,
            reason: "Level requirement not met",
          });
          continue;
        }
      }

      results.push({ id: instanceId, eligible: true });
    }

    return NextResponse.json({ memberships: results });
  } catch (error) {
    console.error("Membership eligibility check error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
