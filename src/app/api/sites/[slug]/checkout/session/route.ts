import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPaymentSession } from "@/lib/adyen";
import { calculateAge, isAgeEligible } from "@/lib/age-utils";
import { subDays } from "date-fns";
import { processInvoiceRegistrations } from "@/lib/invoice-processing";
import { sendTemplatedEmail } from "@/lib/email";
import { getAuthSession } from "@/lib/auth";

interface CartItem {
  referenceId: string;
  type: "program" | "membership" | "item" | "event" | "competition" | "pass";
  name: string;
  description?: string;
  price: number;
  quantity: number;
  athleteId?: string;
  athleteName?: string;
  details?: {
    programId?: string;
    instanceId?: string;
    membershipInstanceId?: string;
    passId?: string;
    athleteId?: string;
    level?: string;
    interval?: string;
    billingInterval?: string;
    requiredMemberships?: string[];
    competitionId?: string;
    competitionName?: string;
    categoryIds?: string[];
    pricingMode?: string;
    entryFee?: number | null;
    seedMarks?: Record<string, Record<string, unknown>>;
    waitlist?: boolean;
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await request.json();
    const { items, userDetails, contactId, billingAddressId, editingContact, editingAddress, discountCode } = body as { 
      items: CartItem[]; 
      userDetails: any; 
      contactId?: string;
      billingAddressId?: string;
      editingContact?: boolean;
      editingAddress?: boolean;
      discountCode?: string 
    };
    const subdomain = params.slug;

    // Validate registration items have quantity of 1
    const registrationTypes = ["program", "event", "membership", "competition", "pass"];
    const invalidItems = items.filter(
      (item) => registrationTypes.includes(item.type) && item.quantity !== 1
    );
    if (invalidItems.length > 0) {
      return NextResponse.json(
        { error: "Registration items must have a quantity of 1" },
        { status: 400 }
      );
    }

    // 1. Get Organization
    const config = await db.websiteConfig.findUnique({
      where: { subdomain },
      include: { organization: true },
    });

    if (!config) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const organizationId = config.organizationId;

    // 2. Server-side waiver verification (per-athlete)
    // Each athlete in the cart needs waivers signed specifically for them
    const programItems = items.filter((item: CartItem) => item.type === "program");
    if (programItems.length > 0) {
      // Build a map of programId -> required waiver IDs
      const programIds = programItems
        .map((item: CartItem) => item.details?.programId || item.referenceId)
        .filter(Boolean);

      const waiverRequirements = await db.programWaiverRequirement.findMany({
        where: {
          programId: { in: programIds },
          waiver: { organizationId, status: "ACTIVE" },
        },
        select: { waiverId: true, programId: true },
      });

      // Map each program to its required waiver IDs
      const programWaiverMap: Record<string, string[]> = {};
      waiverRequirements.forEach((r) => {
        if (!programWaiverMap[r.programId]) programWaiverMap[r.programId] = [];
        if (!programWaiverMap[r.programId].includes(r.waiverId)) {
          programWaiverMap[r.programId].push(r.waiverId);
        }
      });

      const authSession = await getAuthSession();
      const checkUserId = authSession?.user?.id || null;

      for (const item of programItems) {
        const pId = item.details?.programId || item.referenceId;
        const athleteId = item.athleteId || item.details?.athleteId;
        const requiredWaiverIds = programWaiverMap[pId] || [];

        if (requiredWaiverIds.length === 0) continue;

        if (!checkUserId) {
          return NextResponse.json(
            { error: `Required waivers have not been signed for athlete ${item.athleteName || athleteId}. Please sign all waivers before proceeding to payment.` },
            { status: 400 }
          );
        }

        const acceptances = await db.waiverAcceptance.findMany({
          where: {
            userId: checkUserId,
            waiverId: { in: requiredWaiverIds },
            athleteId: athleteId || null,
          },
          select: { waiverId: true },
        });

        const signedIds = new Set(acceptances.map((a) => a.waiverId));
        const unsignedWaivers = requiredWaiverIds.filter((id) => !signedIds.has(id));

        if (unsignedWaivers.length > 0) {
          return NextResponse.json(
            { error: `Required waivers have not been signed for athlete ${item.athleteName || athleteId}. Please sign all waivers before proceeding to payment.` },
            { status: 400 }
          );
        }
      }
    }

    // 2b. Server-side medical info verification
    // Check that all athletes in programs requiring medical info have completed it
    if (programItems.length > 0) {
      const programIds = programItems
        .map((item: CartItem) => item.details?.programId || item.referenceId)
        .filter(Boolean);

      const programsWithMedical = await db.program.findMany({
        where: {
          id: { in: programIds },
          organizationId,
          hasMedicalRequirement: true,
        },
        select: { id: true },
      });

      if (programsWithMedical.length > 0) {
        // Collect unique athlete IDs from program items whose programs require medical
        const medicalProgramIds = new Set(programsWithMedical.map((p) => p.id));
        const athleteIds = [...new Set(
          programItems
            .filter((item: CartItem) => {
              const pid = item.details?.programId || item.referenceId;
              return pid && medicalProgramIds.has(pid);
            })
            .map((item: CartItem) => item.athleteId || item.details?.athleteId)
            .filter(Boolean) as string[]
        )];

        if (athleteIds.length > 0) {
          // Check that each athlete has medical info
          const medicalInfoRecords = await db.athleteMedicalInfo.findMany({
            where: {
              athleteId: { in: athleteIds },
            },
            select: { athleteId: true },
          });

          const athletesWithMedical = new Set(medicalInfoRecords.map((r) => r.athleteId));
          const athletesMissing = athleteIds.filter((id) => !athletesWithMedical.has(id));

          if (athletesMissing.length > 0) {
            return NextResponse.json(
              { error: "Medical information is required for all athletes. Please complete the medical information forms before proceeding to payment." },
              { status: 400 }
            );
          }
        }
      }

      // File requirement validation for programs
      const programsWithFiles = await db.program.findMany({
        where: {
          id: { in: programIds },
          organizationId,
          hasFileRequirement: true,
        },
        select: { id: true },
      });

      if (programsWithFiles.length > 0) {
        const fileProgramIds = new Set(programsWithFiles.map((p) => p.id));
        for (const item of programItems) {
          const pid = item.details?.programId || item.referenceId;
          const athleteId = item.athleteId || item.details?.athleteId;
          if (pid && fileProgramIds.has(pid) && athleteId) {
            const regFile = await db.registrationFile.findFirst({
              where: { athleteId, programId: pid },
              select: { id: true },
            });
            if (!regFile) {
              return NextResponse.json(
                { error: `A required file upload is missing for ${item.athleteName || "an athlete"}. Please complete the file upload step before proceeding.` },
                { status: 400 }
              );
            }
          }
        }
      }

      // Program membership requirement validation
      const programsWithMembership = await db.program.findMany({
        where: {
          id: { in: programIds },
          organizationId,
          hasMembershipRestriction: true,
        },
        select: {
          id: true,
          name: true,
          requiredMemberships: { select: { id: true } },
        },
      });

      if (programsWithMembership.length > 0) {
        const membershipProgramMap = new Map(
          programsWithMembership.map((p) => [p.id, p])
        );

        for (const item of programItems) {
          const pid = item.details?.programId || item.referenceId;
          const athleteId = item.athleteId || item.details?.athleteId;
          const athleteLabel = item.athleteName || athleteId || "unknown";
          const prog = pid ? membershipProgramMap.get(pid) : undefined;
          if (!prog || prog.requiredMemberships.length === 0 || !athleteId) continue;

          const requiredIds = prog.requiredMemberships.map((m) => m.id);

          const activeMembership = await db.athleteMembership.findFirst({
            where: {
              athleteId,
              status: "ACTIVE",
              membershipInstanceId: { in: requiredIds },
            },
            select: { id: true },
          });

          if (!activeMembership) {
            const membershipInCart = items.some((i: CartItem) => {
              if (i.type !== "membership") return false;
              const mInstanceId = i.details?.membershipInstanceId || i.referenceId;
              const mAthleteId = i.athleteId || i.details?.athleteId;
              return requiredIds.includes(mInstanceId) && mAthleteId === athleteId;
            });

            if (!membershipInCart) {
              return NextResponse.json(
                { error: `Athlete "${athleteLabel}" does not have the required membership for "${prog.name}". Please add the membership to your cart or contact the organization.` },
                { status: 400 }
              );
            }
          }
        }
      }
    }

    // 2c. Server-side membership restriction validation
    const membershipItems = items.filter((item: CartItem) => item.type === "membership");
    if (membershipItems.length > 0) {
      const now = new Date();

      for (const item of membershipItems) {
        const instanceId = item.details?.membershipInstanceId || item.referenceId;
        const athleteId = item.athleteId || item.details?.athleteId;
        const athleteLabel = item.athleteName || athleteId || "unknown";

        // Fetch instance with group and restrictions
        const instance = await db.membershipInstance.findUnique({
          where: { id: instanceId },
          include: {
            group: {
              include: {
                levelRequirements: true,
                waiverRequirements: true,
              },
            },
            _count: { select: { athleteMemberships: true } },
          },
        });

        if (!instance) {
          return NextResponse.json(
            { error: `Membership instance not found for "${item.name}".` },
            { status: 400 }
          );
        }

        // Verify instance belongs to this organization
        if (instance.group.organizationId !== organizationId) {
          return NextResponse.json(
            { error: `Membership "${item.name}" does not belong to this organization.` },
            { status: 400 }
          );
        }

        // Check instance is ACTIVE
        if (instance.status !== "ACTIVE") {
          return NextResponse.json(
            { error: `Membership "${item.name}" is not currently available for purchase (status: ${instance.status}).` },
            { status: 400 }
          );
        }

        // Check purchase window
        const purchaseStart = instance.purchaseStartDate
          ?? (instance.group.purchaseWindowDays != null
            ? subDays(instance.startDate, instance.group.purchaseWindowDays)
            : new Date(0));
        const purchaseEnd = instance.purchaseEndDate ?? instance.endDate;

        if (now < purchaseStart || now > purchaseEnd) {
          return NextResponse.json(
            { error: `Membership "${item.name}" is not within its purchase window.` },
            { status: 400 }
          );
        }

        // Check capacity
        if (instance.group.hasCapacityRestriction) {
          const effectiveCapacity = instance.capacity ?? instance.group.capacity;
          if (effectiveCapacity != null && instance._count.athleteMemberships >= effectiveCapacity) {
            return NextResponse.json(
              { error: `Membership "${item.name}" has reached its capacity limit.` },
              { status: 400 }
            );
          }
        }

        // Check duplicate purchase
        if (athleteId) {
          const existing = await db.athleteMembership.findFirst({
            where: {
              athleteId,
              membershipInstanceId: instanceId,
              status: { in: ["ACTIVE"] },
            },
          });
          if (existing) {
            return NextResponse.json(
              { error: `Athlete "${athleteLabel}" already has an active membership for "${item.name}".` },
              { status: 400 }
            );
          }

          // Fetch athlete for restriction checks
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
            },
          });

          if (!athlete) {
            return NextResponse.json(
              { error: `Athlete "${athleteLabel}" not found.` },
              { status: 400 }
            );
          }

          // Gender restriction
          if (instance.group.hasGenderRestriction && instance.group.allowedGenders.length > 0) {
            if (!athlete.gender || !instance.group.allowedGenders.includes(athlete.gender)) {
              return NextResponse.json(
                { error: `Athlete "${athleteLabel}" does not meet the gender requirement for "${item.name}".` },
                { status: 400 }
              );
            }
          }

          // Age restriction
          if (instance.group.hasAgeRestriction) {
            const age = calculateAge(athlete.birthDate);
            if (!isAgeEligible(age, instance.group.minAge, instance.group.maxAge)) {
              return NextResponse.json(
                { error: `Athlete "${athleteLabel}" does not meet the age requirement for "${item.name}" (ages ${instance.group.minAge ?? 0}-${instance.group.maxAge ?? "any"}).` },
                { status: 400 }
              );
            }
          }

          // Level restriction
          if (instance.group.hasLevelRestriction && instance.group.levelRequirements.length > 0) {
            const allowedLevelIds = instance.group.levelRequirements.map((lr) => lr.levelId);
            const mAthleteLevel = athlete.organizationAthletes[0]?.level ?? null;
            if (!mAthleteLevel || !allowedLevelIds.some((lid) => mAthleteLevel === lid)) {
              return NextResponse.json(
                { error: `Athlete "${athleteLabel}" does not meet the level requirement for "${item.name}".` },
                { status: 400 }
              );
            }
          }

          // Waiver requirement check
          if (instance.group.hasWaiverRestriction && instance.group.waiverRequirements.length > 0) {
            const mAuthSession = await getAuthSession();
            const mCheckUserId = mAuthSession?.user?.id || null;

            if (mCheckUserId) {
              const requiredWaiverIds = instance.group.waiverRequirements.map((wr) => wr.waiverId);
              const acceptances = await db.waiverAcceptance.findMany({
                where: {
                  userId: mCheckUserId,
                  waiverId: { in: requiredWaiverIds },
                  athleteId: athleteId || null,
                },
                select: { waiverId: true },
              });

              const signedIds = new Set(acceptances.map((a) => a.waiverId));
              const unsigned = requiredWaiverIds.filter((id) => !signedIds.has(id));

              if (unsigned.length > 0) {
                return NextResponse.json(
                  { error: `Required waivers have not been signed for athlete "${athleteLabel}" for membership "${item.name}". Please sign all waivers before proceeding to payment.` },
                  { status: 400 }
                );
              }
            }
          }

          // Medical requirement check
          if (instance.group.hasMedicalRequirement) {
            const medicalInfo = await db.athleteMedicalInfo.findUnique({
              where: { athleteId },
              select: { athleteId: true },
            });

            if (!medicalInfo) {
              return NextResponse.json(
                { error: `Medical information is required for athlete "${athleteLabel}" for membership "${item.name}". Please complete the medical information form before proceeding to payment.` },
                { status: 400 }
              );
            }
          }
        }
      }
    }

    // 2d. Server-side competition validation and price re-calculation
    const competitionItems = items.filter((item: CartItem) => item.type === "competition");
    const competitionServerPrices = new Map<number, number>(); // map cart index -> server price

    if (competitionItems.length > 0) {
      for (const item of competitionItems) {
        const compId = item.details?.competitionId || item.referenceId;
        const athleteId = item.athleteId || item.details?.athleteId;
        const athleteLabel = item.athleteName || athleteId || "unknown";
        const categoryIds: string[] = item.details?.categoryIds || [];

        if (!compId || !athleteId || categoryIds.length === 0) {
          return NextResponse.json(
            { error: `Invalid competition registration for "${item.name}".` },
            { status: 400 }
          );
        }

        const competition = await db.competition.findUnique({
          where: { id: compId },
          include: {
            categories: {
              where: { id: { in: categoryIds }, isActive: true },
              include: {
                ageCategory: { select: { minAge: true, maxAge: true } },
              },
            },
            pricingTiers: { orderBy: { minEvents: "asc" } },
          },
        });

        if (!competition || competition.organizationId !== organizationId) {
          return NextResponse.json(
            { error: `Competition not found for "${item.name}".` },
            { status: 400 }
          );
        }

        if (competition.publishStatus !== "LIVE") {
          return NextResponse.json(
            { error: `Competition "${competition.name}" is not open for registration.` },
            { status: 400 }
          );
        }

        // Verify all requested categories exist and are active
        if (competition.categories.length !== categoryIds.length) {
          return NextResponse.json(
            { error: `One or more selected events are no longer available for "${competition.name}".` },
            { status: 400 }
          );
        }

        // Fetch athlete for eligibility checks
        const athlete = await db.athlete.findUnique({
          where: { id: athleteId },
          select: {
            id: true,
            birthDate: true,
            gender: true,
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
          return NextResponse.json(
            { error: `Athlete "${athleteLabel}" not found.` },
            { status: 400 }
          );
        }

        const age = calculateAge(athlete.birthDate);

        // Competition-level eligibility
        if (competition.hasAgeRestriction) {
          if (!isAgeEligible(age, competition.minAge, competition.maxAge)) {
            return NextResponse.json(
              { error: `Athlete "${athleteLabel}" does not meet the age requirement for "${competition.name}".` },
              { status: 400 }
            );
          }
        }

        if (competition.hasLevelRestriction && competition.levelRequirementIds.length > 0) {
          const cAthleteLevel = athlete.organizationAthletes[0]?.level ?? null;
          if (!cAthleteLevel || !competition.levelRequirementIds.includes(cAthleteLevel)) {
            return NextResponse.json(
              { error: `Athlete "${athleteLabel}" does not meet the level requirement for "${competition.name}".` },
              { status: 400 }
            );
          }
        }

        if (competition.hasMembershipRestriction && competition.membershipRequirementIds.length > 0) {
          const activeMembershipIds = athlete.memberships.map((m) => m.membershipInstanceId);
          const hasRequired = competition.membershipRequirementIds.some((id) =>
            activeMembershipIds.includes(id)
          );
          if (!hasRequired) {
            // Check if a membership purchase is in the cart for this athlete
            const membershipItems = items.filter((i: CartItem) => i.type === "membership");
            const membershipInCart = membershipItems.some((m: CartItem) => {
              const mInstanceId = m.details?.membershipInstanceId || m.referenceId;
              const mAthleteId = m.athleteId || m.details?.athleteId;
              return (
                competition.membershipRequirementIds.includes(mInstanceId) &&
                mAthleteId === athleteId
              );
            });
            if (!membershipInCart) {
              return NextResponse.json(
                { error: `Athlete "${athleteLabel}" does not have the required membership for "${competition.name}".` },
                { status: 400 }
              );
            }
          }
        }

        // Waiver verification for competition
        if (competition.hasWaiverRestriction && competition.waiverRequirementIds.length > 0) {
          const cAuthSession = await getAuthSession();
          const cCheckUserId = cAuthSession?.user?.id || null;

          if (!cCheckUserId) {
            return NextResponse.json(
              { error: `Required waivers have not been signed for athlete ${athleteLabel} for "${competition.name}". Please sign all waivers before proceeding.` },
              { status: 400 }
            );
          }

          const acceptances = await db.waiverAcceptance.findMany({
            where: {
              userId: cCheckUserId,
              waiverId: { in: competition.waiverRequirementIds },
              athleteId: athleteId || null,
            },
            select: { waiverId: true },
          });

          const signedIds = new Set(acceptances.map((a) => a.waiverId));
          const unsignedWaivers = competition.waiverRequirementIds.filter(
            (id) => !signedIds.has(id)
          );

          if (unsignedWaivers.length > 0) {
            return NextResponse.json(
              { error: `Required waivers have not been signed for athlete ${athleteLabel} for "${competition.name}". Please sign all waivers before proceeding.` },
              { status: 400 }
            );
          }
        }

        // Medical info verification for competition
        if (competition.hasMedicalRequirement) {
          const medicalInfo = await db.athleteMedicalInfo.findUnique({
            where: { athleteId },
            select: { id: true },
          });

          if (!medicalInfo) {
            return NextResponse.json(
              { error: `Medical information is required for athlete ${athleteLabel} for "${competition.name}". Please complete the medical form before proceeding.` },
              { status: 400 }
            );
          }
        }

        // File requirement validation for competition
        if (competition.hasFileRequirement) {
          const regFile = await db.registrationFile.findFirst({
            where: { athleteId, competitionId: competition.id },
            select: { id: true },
          });
          if (!regFile) {
            return NextResponse.json(
              { error: `A required file upload is missing for athlete ${athleteLabel} for "${competition.name}". Please complete the file upload step before proceeding.` },
              { status: 400 }
            );
          }
        }

        // Category-level age eligibility
        for (const cat of competition.categories) {
          if (cat.ageCategory) {
            if (!isAgeEligible(age, cat.ageCategory.minAge, cat.ageCategory.maxAge)) {
              return NextResponse.json(
                { error: `Athlete "${athleteLabel}" is not eligible for one of the selected events in "${competition.name}".` },
                { status: 400 }
              );
            }
          }
        }

        // Check duplicate entries
        const existingEntries = await db.competitionEntry.findMany({
          where: {
            competitionId: compId,
            athleteId,
            competitionCategoryId: { in: categoryIds },
            status: { notIn: ["WITHDRAWN", "REJECTED"] },
          },
          select: { competitionCategoryId: true },
        });

        if (existingEntries.length > 0) {
          return NextResponse.json(
            { error: `Athlete "${athleteLabel}" is already registered for one or more selected events in "${competition.name}".` },
            { status: 400 }
          );
        }

        // Re-calculate price server-side
        const eventCount = categoryIds.length;
        let serverPrice = 0;

        switch (competition.pricingMode) {
          case "FREE":
            serverPrice = 0;
            break;
          case "PER_COMPETITION":
            serverPrice = competition.entryFee ? Number(competition.entryFee) : 0;
            break;
          case "PER_EVENT":
            serverPrice = (competition.entryFee ? Number(competition.entryFee) : 0) * eventCount;
            break;
          case "TIERED": {
            const tiers = competition.pricingTiers;
            let applicableTier = tiers[0];
            for (const tier of tiers) {
              if (eventCount >= tier.minEvents && (tier.maxEvents === null || eventCount <= tier.maxEvents)) {
                applicableTier = tier;
              }
            }
            serverPrice = applicableTier ? Number(applicableTier.pricePerEvent) * eventCount : 0;
            break;
          }
          case "PER_CATEGORY": {
            for (const cat of competition.categories) {
              if (cat.price) serverPrice += Number(cat.price);
            }
            break;
          }
        }

        // Store server-calculated price for this item (use original index in items array)
        const itemIndex = items.indexOf(item);
        competitionServerPrices.set(itemIndex, serverPrice);
      }
    }

    // 3. Calculate Totals - use server-verified prices for competitions
    const subtotal = items.reduce(
      (sum: number, item: CartItem, index: number) => {
        if (item.type === "competition" && competitionServerPrices.has(index)) {
          return sum + competitionServerPrices.get(index)!;
        }
        return sum + Number(item.price) * item.quantity;
      },
      0
    );
    const taxRate = 0.13;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    // 4. Resolve User Contact and Billing Address
    // Use saved contact if contactId provided, else use form data
    let resolvedContact = {
      firstName: userDetails.firstName,
      lastName: userDetails.lastName,
      email: userDetails.email,
      phone: userDetails.phone,
    };

    if (contactId) {
      if (editingContact) {
        resolvedContact = {
          firstName: userDetails.firstName,
          lastName: userDetails.lastName,
          email: userDetails.email,
          phone: userDetails.phone,
        };
        await db.userContact.update({
          where: { id: contactId },
          data: {
            firstName: userDetails.firstName,
            lastName: userDetails.lastName,
            email: userDetails.email,
            phone: userDetails.phone,
          },
        });
      } else {
        const savedContact = await db.userContact.findUnique({ where: { id: contactId } });
        if (savedContact) {
          resolvedContact = {
            firstName: savedContact.firstName,
            lastName: savedContact.lastName,
            email: savedContact.email,
            phone: savedContact.phone,
          };
        }
      }
    }

    // Resolve billing address: use saved address if billingAddressId provided, else use form data
    let resolvedAddress = {
      street: userDetails.address || "",
      city: userDetails.city || "",
      stateProvince: userDetails.stateProvince || "",
      postalCode: userDetails.postalCode || "",
    };

    if (billingAddressId) {
      if (editingAddress) {
        resolvedAddress = {
          street: userDetails.address || "",
          city: userDetails.city || "",
          stateProvince: userDetails.stateProvince || "",
          postalCode: userDetails.postalCode || "",
        };
        await db.userBillingAddress.update({
          where: { id: billingAddressId },
          data: {
            street: userDetails.address || "",
            city: userDetails.city || "",
            stateProvince: userDetails.stateProvince || null,
            postalCode: userDetails.postalCode || "",
          },
        });
      } else {
        const savedAddress = await db.userBillingAddress.findUnique({ where: { id: billingAddressId } });
        if (savedAddress) {
          resolvedAddress = {
            street: savedAddress.street,
            city: savedAddress.city,
            stateProvince: savedAddress.stateProvince || "",
            postalCode: savedAddress.postalCode,
          };
        }
      }
    }

    // Resolve the authenticated user
    const checkoutAuthSession = await getAuthSession();
    const checkoutUserId = checkoutAuthSession?.user?.id || null;

    // Save contacts and addresses to the User profile
    if (checkoutUserId) {
      if (!contactId && resolvedContact.firstName && resolvedContact.email) {
        const existingUserContact = await db.userContact.findFirst({
          where: { userId: checkoutUserId, email: resolvedContact.email },
        });
        if (!existingUserContact) {
          const hasAnyUserContacts = await db.userContact.count({ where: { userId: checkoutUserId } });
          await db.userContact.create({
            data: {
              userId: checkoutUserId,
              firstName: resolvedContact.firstName,
              lastName: resolvedContact.lastName,
              email: resolvedContact.email,
              phone: resolvedContact.phone,
              relationship: "Self",
              isPrimary: hasAnyUserContacts === 0,
            },
          });
        }
      }

      if (!billingAddressId && resolvedAddress.street) {
        const existingUserAddress = await db.userBillingAddress.findFirst({
          where: {
            userId: checkoutUserId,
            street: resolvedAddress.street,
            city: resolvedAddress.city,
            postalCode: resolvedAddress.postalCode,
          },
        });
        if (!existingUserAddress) {
          const hasAnyUserAddresses = await db.userBillingAddress.count({ where: { userId: checkoutUserId } });
          await db.userBillingAddress.create({
            data: {
              userId: checkoutUserId,
              label: "Home",
              street: resolvedAddress.street,
              city: resolvedAddress.city,
              stateProvince: resolvedAddress.stateProvince || null,
              postalCode: resolvedAddress.postalCode,
              country: "US",
              isPrimary: hasAnyUserAddresses === 0,
            },
          });
        }
      }
    }

    // 5. Create Invoice with metadata for post-payment processing
    const membershipInvoiceItems = items.filter((item: CartItem) => item.type === "membership");
    const passInvoiceItems = items.filter((item: CartItem) => item.type === "pass");
    
    // Build metadata for webhook processing
    const invoiceMetadata = {
      membershipPurchases: membershipInvoiceItems.map(item => ({
        membershipInstanceId: item.details?.membershipInstanceId || item.referenceId,
        athleteId: item.athleteId || item.details?.athleteId,
        quantity: item.quantity,
      })),
      passPurchases: passInvoiceItems.map(item => ({
        passId: item.details?.passId || item.referenceId,
        athleteId: item.athleteId || item.details?.athleteId,
        billingInterval: item.details?.billingInterval,
      })),
      programRegistrations: programItems.map(item => ({
        programId: item.details?.programId,
        requiredMemberships: item.details?.requiredMemberships || [],
      })),
      competitionRegistrations: competitionItems.map(item => ({
        competitionId: item.details?.competitionId || item.referenceId,
        athleteId: item.athleteId || item.details?.athleteId,
        categoryIds: item.details?.categoryIds || [],
        seedMarks: item.details?.seedMarks || {},
      })),
    };
    
    const invoice = await db.invoice.create({
        data: {
            reference: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            userId: checkoutUserId,
            organizationId,
            subtotal,
            tax,
            total,
            status: "DRAFT",
            dueDate: new Date(),
            notes: JSON.stringify(invoiceMetadata),
        }
    });

    // 6. Resolve GL codes for line items
    const glCodeMap = new Map<string, string | null>();
    const programIds = items.filter((i: CartItem) => i.type === "program" && i.details?.programId).map((i: CartItem) => i.details!.programId!);
    const passIds = items.filter((i: CartItem) => i.type === "pass").map((i: CartItem) => i.details?.passId || i.referenceId).filter(Boolean);
    const competitionIds = items.filter((i: CartItem) => i.type === "competition").map((i: CartItem) => i.details?.competitionId || i.referenceId).filter(Boolean);
    const membershipInstanceIds = items.filter((i: CartItem) => i.type === "membership").map((i: CartItem) => i.details?.membershipInstanceId || i.referenceId).filter(Boolean);

    if (programIds.length > 0) {
      const programs = await db.program.findMany({ where: { id: { in: programIds } }, select: { id: true, glCodeId: true } });
      for (const p of programs) if (p.glCodeId) glCodeMap.set(`program:${p.id}`, p.glCodeId);
    }
    if (passIds.length > 0) {
      const passes = await db.pass.findMany({ where: { id: { in: passIds as string[] } }, select: { id: true, glCodeId: true } });
      for (const p of passes) if (p.glCodeId) glCodeMap.set(`pass:${p.id}`, p.glCodeId);
    }
    if (competitionIds.length > 0) {
      const comps = await db.competition.findMany({ where: { id: { in: competitionIds as string[] } }, select: { id: true, glCodeId: true } });
      for (const c of comps) if (c.glCodeId) glCodeMap.set(`competition:${c.id}`, c.glCodeId);
    }
    if (membershipInstanceIds.length > 0) {
      const instances = await db.membershipInstance.findMany({ where: { id: { in: membershipInstanceIds as string[] } }, select: { id: true, group: { select: { glCodeId: true } } } });
      for (const i of instances) if (i.group.glCodeId) glCodeMap.set(`membership:${i.id}`, i.group.glCodeId);
    }

    // Fetch org default GL codes as fallbacks
    const entityTypeToDefault = new Map<string, string>();
    const defaultCodes = await db.gLCode.findMany({
      where: { organizationId, isDefault: true, defaultForType: { not: null } },
      select: { id: true, defaultForType: true },
    });
    for (const d of defaultCodes) {
      if (d.defaultForType) entityTypeToDefault.set(d.defaultForType, d.id);
    }

    const ITEM_TYPE_TO_ENTITY_TYPE: Record<string, string> = {
      program: "PROGRAM",
      pass: "PASS",
      competition: "COMPETITION",
      membership: "MEMBERSHIP",
      event: "EVENT",
      item: "PRODUCT",
    };

    // 7. Create Line Items with appropriate metadata
    await db.lineItem.createMany({
        data: items.map((item: CartItem, index: number) => {
            const isCompetition = item.type === "competition";
            const serverPrice = isCompetition && competitionServerPrices.has(index)
              ? competitionServerPrices.get(index)!
              : Number(item.price) * item.quantity;

            let glCodeId: string | undefined;
            if (item.type === "program") glCodeId = glCodeMap.get(`program:${item.details?.programId}`) ?? undefined;
            else if (item.type === "pass") glCodeId = glCodeMap.get(`pass:${item.details?.passId || item.referenceId}`) ?? undefined;
            else if (item.type === "competition") glCodeId = glCodeMap.get(`competition:${item.details?.competitionId || item.referenceId}`) ?? undefined;
            else if (item.type === "membership") glCodeId = glCodeMap.get(`membership:${item.details?.membershipInstanceId || item.referenceId}`) ?? undefined;

            // Fallback to org default for this entity type
            if (!glCodeId) {
              const entityType = ITEM_TYPE_TO_ENTITY_TYPE[item.type];
              if (entityType) glCodeId = entityTypeToDefault.get(entityType);
            }

            return {
              invoiceId: invoice.id,
              description: item.name,
              quantity: item.quantity,
              unitPrice: isCompetition ? serverPrice : item.price,
              total: serverPrice,
              programId: item.type === 'program' ? (item.details?.programId || undefined) : undefined,
              membershipInstanceId: item.type === 'membership' ? (item.details?.membershipInstanceId || item.referenceId) : undefined,
              passId: item.type === 'pass' ? (item.details?.passId || item.referenceId) : undefined,
              competitionId: isCompetition ? (item.details?.competitionId || item.referenceId) : undefined,
              athleteId: item.athleteId || item.details?.athleteId || undefined,
              glCodeId,
            };
        })
    });

    // 8. Handle payment — skip Adyen entirely for $0 orders
    if (total === 0) {
      const payment = await db.payment.create({
        data: {
          invoiceId: invoice.id,
          userId: checkoutUserId || undefined,
          amount: 0,
          method: "CASH",
          status: "COMPLETED",
          processedAt: new Date(),
        },
      });

      await db.transaction.create({
        data: {
          organizationId,
          paymentId: payment.id,
          pspReference: `FREE-${invoice.id}`,
          merchantRef: invoice.reference,
          type: "PAYMENT",
          amount: 0,
          currency: "USD",
          status: "SETTLED",
          method: "comp",
          description: `Free checkout – ${invoice.reference}`,
          settledAt: new Date(),
        },
      });

      await db.invoice.update({
        where: { id: invoice.id },
        data: { status: "PAID" },
      });

      await processInvoiceRegistrations(invoiceMetadata, items, checkoutUserId, organizationId);

      // Send receipt email (fire-and-forget so it doesn't block the response)
      const protocol = request.headers.get("x-forwarded-proto") || "http";
      const host = request.headers.get("host");
      const receiptUrl = `${protocol}://${host}/receipt/${invoice.id}`;
      const lineItemsHtml = items
        .map((item: CartItem) => `<tr><td style="padding: 4px 0;">${item.name}</td><td style="padding: 4px 0; text-align: right;">$${(Number(item.price) * item.quantity).toFixed(2)}</td></tr>`)
        .join("");
      const lineItemsText = items
        .map((item: CartItem) => `${item.name} — $${(Number(item.price) * item.quantity).toFixed(2)}`)
        .join("\n");

      sendTemplatedEmail("checkout-receipt", [resolvedContact.email], {
        name: resolvedContact.firstName,
        reference: invoice.reference,
        total: `$${total.toFixed(2)}`,
        lineItemsHtml,
        lineItemsText,
        receiptUrl,
      }).catch((err) => console.error("Failed to send receipt email:", err));

      return NextResponse.json({
        freeCheckout: true,
        invoiceId: invoice.id,
        hasMembershipPurchases: membershipInvoiceItems.length > 0,
        hasProgramRegistrations: programItems.length > 0,
        hasCompetitionRegistrations: competitionItems.length > 0,
      });
    }

    // Create Adyen Session for non-zero orders
    // We'll use the invoice ID as reference so we can update it later
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host");
    const returnUrl = `${protocol}://${host}/receipt/${invoice.id}`;

    const session = await createPaymentSession(
        total,
        "USD",
        invoice.id, // Using invoice ID as reference for webhook matching
        returnUrl,
        resolvedContact.email
    );

    return NextResponse.json({
        sessionId: session.id,
        sessionData: session.sessionData,
        invoiceId: invoice.id,
        hasMembershipPurchases: membershipInvoiceItems.length > 0,
        hasProgramRegistrations: programItems.length > 0,
        hasCompetitionRegistrations: competitionItems.length > 0,
    });

  } catch (error) {
    console.error("Checkout Session Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
