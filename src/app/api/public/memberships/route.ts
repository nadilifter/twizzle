import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subDays } from "date-fns";
import { isFeatureEnabled } from "@/lib/feature-resolver";
import { resolvePublicRequest } from "@/lib/public-api";
import { getRegistrationStatus } from "@/lib/registration-utils";
import { checkApiRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/public/memberships?organizationId=xxx
 *
 * Public endpoint for the storefront. Returns membership groups that have
 * at least one purchasable instance (ACTIVE status, within purchase window,
 * capacity not exhausted).
 *
 * Optional query params for client-side pre-filtering:
 *   - athleteGender: filter by gender restriction
 *   - athleteAge: filter by age restriction
 *   - athleteLevel: filter by level restriction
 */
export async function GET(request: NextRequest) {
  const rateLimited = await checkApiRateLimit(request, "public");
  if (rateLimited) return rateLimited;

  try {
    const { searchParams } = new URL(request.url);
    const result = await resolvePublicRequest(request, searchParams.get("organizationId"));
    if (result instanceof NextResponse) return result;
    const { organizationId } = result;

    const membershipsFeatureEnabled = await isFeatureEnabled(organizationId, "memberships");
    if (!membershipsFeatureEnabled) {
      return NextResponse.json({ data: [] });
    }

    const now = new Date();

    // Fetch all membership groups for the organization with their active instances
    const groups = await db.membershipGroup.findMany({
      where: {
        organizationId,
      },
      include: {
        instances: {
          where: {
            status: "ACTIVE",
          },
          include: {
            _count: { select: { athleteMemberships: true } },
          },
          orderBy: { startDate: "asc" },
        },
        levelRequirements: {
          include: {
            level: { select: { id: true, name: true, color: true } },
          },
        },
        waiverRequirements: {
          include: {
            waiver: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Filter to groups with at least one purchasable instance
    const purchasableGroups = groups
      .map((group) => {
        const purchasableInstances = group.instances.filter((instance) => {
          // Calculate purchase window
          const purchaseStart =
            instance.purchaseStartDate ??
            (group.purchaseWindowDays != null
              ? subDays(instance.startDate, group.purchaseWindowDays)
              : new Date(0));
          const purchaseEnd = instance.purchaseEndDate ?? instance.endDate;

          const withinWindow = now >= purchaseStart && now <= purchaseEnd;

          // Check capacity
          const effectiveCapacity = instance.capacity ?? group.capacity;
          const hasCapacity =
            !group.hasCapacityRestriction ||
            effectiveCapacity == null ||
            instance._count.athleteMemberships < effectiveCapacity;

          // Check registration window (new fields take precedence over legacy purchase window)
          if (
            instance.registrationStartDate ||
            instance.registrationEndDate ||
            !instance.registrationOpen
          ) {
            const regStatus = getRegistrationStatus(instance);
            if (regStatus === "closed") return false;
          }

          return withinWindow && hasCapacity;
        });

        if (purchasableInstances.length === 0) return null;

        return {
          id: group.id,
          name: group.name,
          description: group.description,
          isRecurring: group.isRecurring,
          defaultPrice: group.defaultPrice,
          defaultBillingInterval: group.defaultBillingInterval,

          // Restriction info for UI display
          hasGenderRestriction: group.hasGenderRestriction,
          hasAgeRestriction: group.hasAgeRestriction,
          hasLevelRestriction: group.hasLevelRestriction,
          hasCapacityRestriction: group.hasCapacityRestriction,
          hasWaiverRestriction: group.hasWaiverRestriction,
          hasMedicalRequirement: group.hasMedicalRequirement,
          allowedGenders: group.allowedGenders,
          minAge: group.minAge,
          maxAge: group.maxAge,

          levelRequirements: group.levelRequirements,
          waiverRequirements: group.waiverRequirements,

          // Purchasable instances (with counts for capacity display)
          instances: purchasableInstances.map((inst) => {
            const regStatus =
              inst.registrationStartDate || inst.registrationEndDate || !inst.registrationOpen
                ? getRegistrationStatus(inst)
                : "open";
            return {
              id: inst.id,
              name: inst.name,
              price: inst.price,
              billingInterval: inst.billingInterval,
              startDate: inst.startDate,
              endDate: inst.endDate,
              capacity: inst.capacity ?? group.capacity,
              enrolled: inst._count.athleteMemberships,
              registrationStatus: regStatus,
              registrationStartDate: inst.registrationStartDate,
            };
          }),
        };
      })
      .filter(Boolean);

    // Optional: Apply athlete-specific filtering
    const athleteGender = searchParams.get("athleteGender");
    const athleteAge = searchParams.get("athleteAge");
    const athleteLevel = searchParams.get("athleteLevel");

    let filtered = purchasableGroups;

    if (athleteGender) {
      filtered = filtered.filter(
        (g) =>
          !g!.hasGenderRestriction ||
          g!.allowedGenders.length === 0 ||
          g!.allowedGenders.includes(
            athleteGender as "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY"
          )
      );
    }

    if (athleteAge) {
      const age = parseInt(athleteAge);
      if (!isNaN(age)) {
        filtered = filtered.filter(
          (g) =>
            !g!.hasAgeRestriction ||
            ((g!.minAge == null || age >= g!.minAge) && (g!.maxAge == null || age <= g!.maxAge))
        );
      }
    }

    if (athleteLevel) {
      filtered = filtered.filter(
        (g) =>
          !g!.hasLevelRestriction || g!.levelRequirements.some((lr) => lr.levelId === athleteLevel)
      );
    }

    return NextResponse.json({ data: filtered });
  } catch (error) {
    console.error("Error fetching public memberships:", error);
    return NextResponse.json({ error: "Failed to fetch memberships" }, { status: 500 });
  }
}
