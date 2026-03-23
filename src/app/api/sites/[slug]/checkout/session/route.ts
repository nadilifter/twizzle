import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPaymentSession } from "@/lib/adyen";
import { calculateAge, isAgeEligible } from "@/lib/age-utils";
import { subDays } from "date-fns";
import { processInvoiceRegistrations } from "@/lib/invoice-processing";
import { sendTemplatedEmail } from "@/lib/email";
import { getAuthSession } from "@/lib/auth";
import { checkApiRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";

const cartItemSchema = z.object({
  referenceId: z.string().min(1),
  type: z.enum(["program", "membership", "item", "event", "competition", "pass"]),
  name: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  price: z.number().min(0),
  quantity: z.number().int().min(1),
  athleteId: z.string().optional(),
  athleteName: z.string().max(500).optional(),
  details: z.object({
    programId: z.string().optional(),
    instanceId: z.string().optional(),
    membershipInstanceId: z.string().optional(),
    passId: z.string().optional(),
    athleteId: z.string().optional(),
    level: z.string().optional(),
    interval: z.string().optional(),
    billingInterval: z.string().optional(),
    requiredMemberships: z.array(z.string()).optional(),
    competitionId: z.string().optional(),
    competitionName: z.string().optional(),
    categoryIds: z.array(z.string()).optional(),
    pricingMode: z.string().optional(),
    entryFee: z.number().nullable().optional(),
    seedMarks: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
    waitlist: z.boolean().optional(),
  }).optional(),
});

const checkoutBodySchema = z.object({
  items: z.array(cartItemSchema).min(1).max(100),
  userDetails: z.object({
    firstName: z.string().min(1).max(255),
    lastName: z.string().min(1).max(255),
    email: z.string().email().max(320),
    phone: z.string().max(30).refine((val) => !val || isValidPhoneNumber(val), "Please enter a valid phone number").optional().default(""),
    address: z.string().max(500).optional().default(""),
    city: z.string().max(255).optional().default(""),
    stateProvince: z.string().max(255).optional().default(""),
    postalCode: z.string().max(20).optional().default(""),
  }),
  contactId: z.string().optional(),
  billingAddressId: z.string().optional(),
  editingContact: z.boolean().optional(),
  editingAddress: z.boolean().optional(),
  discountCode: z.string().max(100).optional(),
});

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
  const rateLimitResponse = await checkApiRateLimit(request, "checkout", RATE_LIMITS.sensitive);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const parsed = checkoutBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { items: validatedItems, userDetails, contactId, billingAddressId, editingContact, editingAddress, discountCode } = parsed.data;
    const items = validatedItems as CartItem[];
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

    // Resolve auth session once (avoids repeated DB lookups across validation steps)
    const authUserId = (await getAuthSession())?.user?.id || null;

    // 2. Server-side waiver verification (per-athlete)
    const programItems = items.filter((item: CartItem) => item.type === "program");
    if (programItems.length > 0) {
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

      const programWaiverMap: Record<string, string[]> = {};
      waiverRequirements.forEach((r) => {
        if (!programWaiverMap[r.programId]) programWaiverMap[r.programId] = [];
        if (!programWaiverMap[r.programId].includes(r.waiverId)) {
          programWaiverMap[r.programId].push(r.waiverId);
        }
      });

      // Batch waiver acceptance check: single query instead of one per cart item
      const allRequiredWaiverIds = [...new Set(
        programItems.flatMap((item: CartItem) => {
          const pId = item.details?.programId || item.referenceId;
          return programWaiverMap[pId] || [];
        })
      )];

      if (allRequiredWaiverIds.length > 0) {
        if (!authUserId) {
          const firstItem = programItems.find((item: CartItem) => {
            const pId = item.details?.programId || item.referenceId;
            return (programWaiverMap[pId] || []).length > 0;
          });
          return NextResponse.json(
            { error: `Required waivers have not been signed for athlete ${firstItem?.athleteName || firstItem?.athleteId || firstItem?.details?.athleteId}. Please sign all waivers before proceeding to payment.` },
            { status: 400 }
          );
        }

        const allProgramAcceptances = await db.waiverAcceptance.findMany({
          where: {
            userId: authUserId,
            waiverId: { in: allRequiredWaiverIds },
          },
          select: { waiverId: true, athleteId: true },
        });

        // Index acceptances by athleteId for O(1) per-item lookup
        const acceptanceIndex = new Map<string, Set<string>>();
        for (const a of allProgramAcceptances) {
          const key = a.athleteId ?? "__null__";
          if (!acceptanceIndex.has(key)) acceptanceIndex.set(key, new Set());
          acceptanceIndex.get(key)!.add(a.waiverId);
        }

        for (const item of programItems) {
          const pId = item.details?.programId || item.referenceId;
          const athleteId = item.athleteId || item.details?.athleteId;
          const requiredWaiverIds = programWaiverMap[pId] || [];
          if (requiredWaiverIds.length === 0) continue;

          const key = athleteId ?? "__null__";
          const signedIds = acceptanceIndex.get(key) || new Set();
          const unsignedWaivers = requiredWaiverIds.filter((id: string) => !signedIds.has(id));

          if (unsignedWaivers.length > 0) {
            return NextResponse.json(
              { error: `Required waivers have not been signed for athlete ${item.athleteName || athleteId}. Please sign all waivers before proceeding to payment.` },
              { status: 400 }
            );
          }
        }
      }
    }

    // 2b. Server-side program requirement checks (medical, files, memberships)
    // Runs all three program requirement queries in parallel to minimize latency.
    if (programItems.length > 0) {
      const programIds = programItems
        .map((item: CartItem) => item.details?.programId || item.referenceId)
        .filter(Boolean);

      const [programsWithMedical, programsWithFiles, programsWithMembership] = await Promise.all([
        db.program.findMany({
          where: { id: { in: programIds }, organizationId, hasMedicalRequirement: true },
          select: { id: true },
        }),
        db.program.findMany({
          where: { id: { in: programIds }, organizationId, hasFileRequirement: true },
          select: { id: true },
        }),
        db.program.findMany({
          where: { id: { in: programIds }, organizationId, hasMembershipRestriction: true },
          select: { id: true, name: true, requiredMemberships: { select: { id: true } } },
        }),
      ]);

      // Medical info check (already batched)
      if (programsWithMedical.length > 0) {
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
          const medicalInfoRecords = await db.athleteMedicalInfo.findMany({
            where: { athleteId: { in: athleteIds } },
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

      // File requirement check — single batch query instead of per-item
      if (programsWithFiles.length > 0) {
        const fileProgramIds = new Set(programsWithFiles.map((p) => p.id));
        const fileCheckPairs = programItems
          .map((item: CartItem) => ({
            programId: item.details?.programId || item.referenceId,
            athleteId: item.athleteId || item.details?.athleteId,
            athleteName: item.athleteName,
          }))
          .filter((p) => !!(p.programId && fileProgramIds.has(p.programId) && p.athleteId)) as
          { programId: string; athleteId: string; athleteName: string | undefined }[];

        if (fileCheckPairs.length > 0) {
          const allFiles = await db.registrationFile.findMany({
            where: {
              OR: fileCheckPairs.map((p) => ({
                athleteId: p.athleteId,
                programId: p.programId,
              })),
            },
            select: { athleteId: true, programId: true },
          });

          const fileSet = new Set(allFiles.map((f) => `${f.athleteId}:${f.programId}`));
          for (const pair of fileCheckPairs) {
            if (!fileSet.has(`${pair.athleteId}:${pair.programId}`)) {
              return NextResponse.json(
                { error: `A required file upload is missing for ${pair.athleteName || "an athlete"}. Please complete the file upload step before proceeding.` },
                { status: 400 }
              );
            }
          }
        }
      }

      // Membership requirement check — single batch query instead of per-item
      if (programsWithMembership.length > 0) {
        const membershipProgramMap = new Map(
          programsWithMembership.map((p) => [p.id, p])
        );

        // Collect all unique athlete IDs and required membership instance IDs
        const membershipCheckPairs: { item: CartItem; programId: string; athleteId: string }[] = [];
        const allRequiredMembershipIds = new Set<string>();
        const allMembershipAthleteIds = new Set<string>();

        for (const item of programItems) {
          const pid = item.details?.programId || item.referenceId;
          const athleteId = item.athleteId || item.details?.athleteId;
          const prog = pid ? membershipProgramMap.get(pid) : undefined;
          if (!prog || prog.requiredMemberships.length === 0 || !athleteId) continue;
          membershipCheckPairs.push({ item, programId: pid, athleteId });
          allMembershipAthleteIds.add(athleteId);
          for (const m of prog.requiredMemberships) allRequiredMembershipIds.add(m.id);
        }

        if (membershipCheckPairs.length > 0) {
          const activeMemberships = await db.athleteMembership.findMany({
            where: {
              athleteId: { in: [...allMembershipAthleteIds] },
              status: "ACTIVE",
              membershipInstanceId: { in: [...allRequiredMembershipIds] },
            },
            select: { athleteId: true, membershipInstanceId: true },
          });

          const membershipSet = new Set(
            activeMemberships.map((m) => `${m.athleteId}:${m.membershipInstanceId}`)
          );

          for (const { item, programId, athleteId } of membershipCheckPairs) {
            const prog = membershipProgramMap.get(programId)!;
            const requiredIds = prog.requiredMemberships.map((m) => m.id);
            const athleteLabel = item.athleteName || athleteId || "unknown";
            const hasActiveMembership = requiredIds.some(
              (rid) => membershipSet.has(`${athleteId}:${rid}`)
            );

            if (!hasActiveMembership) {
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
            if (authUserId) {
              const requiredWaiverIds = instance.group.waiverRequirements.map((wr) => wr.waiverId);
              const acceptances = await db.waiverAcceptance.findMany({
                where: {
                  userId: authUserId,
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
          if (!authUserId) {
            return NextResponse.json(
              { error: `Required waivers have not been signed for athlete ${athleteLabel} for "${competition.name}". Please sign all waivers before proceeding.` },
              { status: 400 }
            );
          }

          const acceptances = await db.waiverAcceptance.findMany({
            where: {
              userId: authUserId,
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

    // 3. Server-side price verification for all item types
    const serverPrices = new Map<number, number>();

    // Copy competition prices already calculated above
    for (const [idx, price] of competitionServerPrices) {
      serverPrices.set(idx, price);
    }

    // Verify program prices
    const programItemsForPrice = items
      .map((item: CartItem, index: number) => ({ item, index }))
      .filter(({ item }) => item.type === "program");
    if (programItemsForPrice.length > 0) {
      const allProgramIds = [...new Set(
        programItemsForPrice.map(({ item }) => item.details?.programId || item.referenceId).filter(Boolean)
      )] as string[];
      const programsForPrice = await db.program.findMany({
        where: { id: { in: allProgramIds }, organizationId },
        select: { id: true, basePrice: true, perSessionPrice: true, pricingModel: true },
      });
      const programPriceMap = new Map(programsForPrice.map(p => [p.id, p]));
      for (const { item, index } of programItemsForPrice) {
        const programId = item.details?.programId || item.referenceId;
        const prog = programPriceMap.get(programId);
        if (prog) {
          const price = prog.pricingModel === "PER_SESSION"
            ? Number(prog.perSessionPrice ?? 0)
            : Number(prog.basePrice ?? 0);
          serverPrices.set(index, price * item.quantity);
        }
      }
    }

    // Verify membership prices
    const membershipItemsForPrice = items
      .map((item: CartItem, index: number) => ({ item, index }))
      .filter(({ item }) => item.type === "membership");
    if (membershipItemsForPrice.length > 0) {
      const allMembershipIds = [...new Set(
        membershipItemsForPrice.map(({ item }) => item.details?.membershipInstanceId || item.referenceId).filter(Boolean)
      )] as string[];
      const instancesForPrice = await db.membershipInstance.findMany({
        where: { id: { in: allMembershipIds } },
        select: { id: true, price: true },
      });
      const membershipPriceMap = new Map(instancesForPrice.map(m => [m.id, Number(m.price)]));
      for (const { item, index } of membershipItemsForPrice) {
        const instanceId = item.details?.membershipInstanceId || item.referenceId;
        const price = membershipPriceMap.get(instanceId);
        if (price !== undefined) {
          serverPrices.set(index, price * item.quantity);
        }
      }
    }

    // Verify pass prices
    const passItemsForPrice = items
      .map((item: CartItem, index: number) => ({ item, index }))
      .filter(({ item }) => item.type === "pass");
    if (passItemsForPrice.length > 0) {
      const allPassIds = [...new Set(
        passItemsForPrice.map(({ item }) => item.details?.passId || item.referenceId).filter(Boolean)
      )] as string[];
      const passesForPrice = await db.pass.findMany({
        where: { id: { in: allPassIds }, organizationId },
        select: { id: true, price: true },
      });
      const passPriceMap = new Map(passesForPrice.map(p => [p.id, Number(p.price)]));
      for (const { item, index } of passItemsForPrice) {
        const passId = item.details?.passId || item.referenceId;
        const price = passPriceMap.get(passId);
        if (price !== undefined) {
          serverPrices.set(index, price * item.quantity);
        }
      }
    }

    // Calculate totals using server-verified prices
    const taxRate = config.organization.taxEnabled !== false
      ? Number(config.organization.taxRate ?? 0)
      : 0;

    const subtotal = items.reduce(
      (sum: number, item: CartItem, index: number) => {
        if (serverPrices.has(index)) {
          return sum + serverPrices.get(index)!;
        }
        return sum + Number(item.price) * item.quantity;
      },
      0
    );
    // 3b. Validate and apply discount code
    let discountRecord: { id: string; type: string; amount: any; name: string } | null = null;
    let discountLineAmount = 0;

    if (discountCode) {
      const discount = await db.discount.findFirst({
        where: { code: discountCode.toUpperCase(), organizationId },
      });

      if (discount) {
        const now = new Date();
        const validFrom = new Date(discount.validFrom);
        const validTo = discount.validTo ? new Date(discount.validTo) : null;
        const isValid =
          discount.status !== "DRAFT" &&
          validFrom <= now &&
          (!validTo || validTo >= now) &&
          (!discount.usageLimit || discount.usageCount < discount.usageLimit);

        if (isValid) {
          discountRecord = {
            id: discount.id,
            type: discount.type,
            amount: discount.amount,
            name: discount.name,
          };
          if (discount.type === "PERCENTAGE") {
            discountLineAmount = Math.round((subtotal * Number(discount.amount)) / 100 * 100) / 100;
          } else {
            discountLineAmount = Math.round(Math.min(Number(discount.amount), subtotal) * 100) / 100;
          }
        }
      }
    }

    const discountedSubtotal = Math.max(subtotal - discountLineAmount, 0);
    const tax = Math.round(discountedSubtotal * taxRate * 100) / 100;
    const total = Math.round((discountedSubtotal + tax) * 100) / 100;

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
        if (!authUserId) {
          return NextResponse.json({ error: "Authentication required to update contact" }, { status: 401 });
        }
        const ownedContact = await db.userContact.findFirst({
          where: { id: contactId, userId: authUserId },
          select: { id: true },
        });
        if (!ownedContact) {
          return NextResponse.json({ error: "Contact not found" }, { status: 404 });
        }
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
        if (!authUserId) {
          return NextResponse.json({ error: "Authentication required to update address" }, { status: 401 });
        }
        const ownedAddress = await db.userBillingAddress.findFirst({
          where: { id: billingAddressId, userId: authUserId },
          select: { id: true },
        });
        if (!ownedAddress) {
          return NextResponse.json({ error: "Address not found" }, { status: 404 });
        }
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

    // Save contacts and addresses to the User profile
    if (authUserId) {
      if (!contactId && resolvedContact.firstName && resolvedContact.email) {
        const existingUserContact = await db.userContact.findFirst({
          where: { userId: authUserId, email: resolvedContact.email },
        });
        if (!existingUserContact) {
          const hasAnyUserContacts = await db.userContact.count({ where: { userId: authUserId } });
          await db.userContact.create({
            data: {
              userId: authUserId,
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
            userId: authUserId,
            street: resolvedAddress.street,
            city: resolvedAddress.city,
            postalCode: resolvedAddress.postalCode,
          },
        });
        if (!existingUserAddress) {
          const hasAnyUserAddresses = await db.userBillingAddress.count({ where: { userId: authUserId } });
          await db.userBillingAddress.create({
            data: {
              userId: authUserId,
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
            reference: `INV-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
            userId: authUserId,
            organizationId,
            subtotal: discountedSubtotal,
            tax,
            total,
            status: "DRAFT",
            dueDate: new Date(),
            notes: JSON.stringify(invoiceMetadata),
        }
    });

    // 6. Resolve GL codes for line items (all queries run in parallel)
    const glCodeMap = new Map<string, string | null>();
    const glProgramIds = items.filter((i: CartItem) => i.type === "program" && i.details?.programId).map((i: CartItem) => i.details!.programId!);
    const glPassIds = items.filter((i: CartItem) => i.type === "pass").map((i: CartItem) => i.details?.passId || i.referenceId).filter(Boolean);
    const glCompetitionIds = items.filter((i: CartItem) => i.type === "competition").map((i: CartItem) => i.details?.competitionId || i.referenceId).filter(Boolean);
    const glMembershipInstanceIds = items.filter((i: CartItem) => i.type === "membership").map((i: CartItem) => i.details?.membershipInstanceId || i.referenceId).filter(Boolean);

    const [glPrograms, glPasses, glComps, glInstances, defaultCodes] = await Promise.all([
      glProgramIds.length > 0
        ? db.program.findMany({ where: { id: { in: glProgramIds } }, select: { id: true, glCodeId: true } })
        : [],
      glPassIds.length > 0
        ? db.pass.findMany({ where: { id: { in: glPassIds as string[] } }, select: { id: true, glCodeId: true } })
        : [],
      glCompetitionIds.length > 0
        ? db.competition.findMany({ where: { id: { in: glCompetitionIds as string[] } }, select: { id: true, glCodeId: true } })
        : [],
      glMembershipInstanceIds.length > 0
        ? db.membershipInstance.findMany({ where: { id: { in: glMembershipInstanceIds as string[] } }, select: { id: true, group: { select: { glCodeId: true } } } })
        : [],
      db.gLCode.findMany({
        where: { organizationId, isDefault: true, defaultForType: { not: null } },
        select: { id: true, defaultForType: true },
      }),
    ]);

    for (const p of glPrograms) if (p.glCodeId) glCodeMap.set(`program:${p.id}`, p.glCodeId);
    for (const p of glPasses) if (p.glCodeId) glCodeMap.set(`pass:${p.id}`, p.glCodeId);
    for (const c of glComps) if (c.glCodeId) glCodeMap.set(`competition:${c.id}`, c.glCodeId);
    for (const i of glInstances) if (i.group.glCodeId) glCodeMap.set(`membership:${i.id}`, i.group.glCodeId);

    const entityTypeToDefault = new Map<string, string>();
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
            const serverPrice = serverPrices.has(index)
              ? serverPrices.get(index)!
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
              unitPrice: serverPrices.has(index) ? serverPrice / item.quantity : item.price,
              total: serverPrice,
              programId: item.type === 'program' ? (item.details?.programId || undefined) : undefined,
              membershipInstanceId: item.type === 'membership' ? (item.details?.membershipInstanceId || item.referenceId) : undefined,
              passId: item.type === 'pass' ? (item.details?.passId || item.referenceId) : undefined,
              competitionId: item.type === 'competition' ? (item.details?.competitionId || item.referenceId) : undefined,
              athleteId: item.athleteId || item.details?.athleteId || undefined,
              glCodeId,
            };
        })
    });

    // 7b. Add discount line item and increment usage count
    if (discountRecord && discountLineAmount > 0) {
      await db.lineItem.create({
        data: {
          invoiceId: invoice.id,
          description: `Discount: ${discountRecord.name}`,
          quantity: 1,
          unitPrice: -discountLineAmount,
          total: -discountLineAmount,
          discountId: discountRecord.id,
        },
      });

      await db.discount.update({
        where: { id: discountRecord.id },
        data: { usageCount: { increment: 1 } },
      });
    }

    // 8. Handle payment — skip Adyen entirely for $0 orders
    if (total === 0) {
      const payment = await db.payment.create({
        data: {
          invoiceId: invoice.id,
          userId: authUserId || undefined,
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

      await processInvoiceRegistrations(invoiceMetadata, items, authUserId, organizationId);

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
        taxRate,
        hasMembershipPurchases: membershipInvoiceItems.length > 0,
        hasProgramRegistrations: programItems.length > 0,
        hasCompetitionRegistrations: competitionItems.length > 0,
      });
    }

    // Build Adyen line items with per-item tax breakdown (all amounts in minor units / cents)
    const taxPct = Math.round(taxRate * 10000); // Adyen wants percentage × 100 (e.g. 6.25% = 625)
    const totalMinor = Math.round(total * 100);
    const taxMinor = Math.round(tax * 100);
    const subtotalMinor = totalMinor - taxMinor;

    const adyenLineItems = items.map((item: CartItem, index: number) => {
      const itemTotal = serverPrices.has(index)
        ? serverPrices.get(index)!
        : Number(item.price) * item.quantity;
      const itemShare = subtotal > 0 ? itemTotal / subtotal : 0;
      const itemDiscount = Math.round(discountLineAmount * itemShare * 100) / 100;
      const itemAfterDiscount = Math.max(itemTotal - itemDiscount, 0);
      const excl = Math.round(itemAfterDiscount * 100);
      const itemTaxMinor = Math.round(itemAfterDiscount * taxRate * 100);
      return {
        id: item.referenceId,
        description: item.name,
        quantity: item.quantity,
        amountExcludingTax: excl,
        taxAmount: itemTaxMinor,
        amountIncludingTax: excl + itemTaxMinor,
        taxPercentage: taxPct,
      };
    });

    // Correct rounding residuals so line item sums exactly equal the session amount
    // (required by payment methods like Klarna/AfterPay)
    if (adyenLineItems.length > 0) {
      const sumExcl = adyenLineItems.reduce((s, li) => s + li.amountExcludingTax, 0);
      const sumTax = adyenLineItems.reduce((s, li) => s + li.taxAmount, 0);
      const last = adyenLineItems[adyenLineItems.length - 1];
      last.amountExcludingTax += subtotalMinor - sumExcl;
      last.taxAmount += taxMinor - sumTax;
      last.amountIncludingTax = last.amountExcludingTax + last.taxAmount;
    }

    if (discountRecord && discountLineAmount > 0) {
      adyenLineItems.push({
        id: `discount-${discountRecord.id}`,
        description: `Discount: ${discountRecord.name}`,
        quantity: 1,
        amountExcludingTax: 0,
        taxAmount: 0,
        amountIncludingTax: 0,
        taxPercentage: 0,
      });
    }

    // Create Adyen Session for non-zero orders
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host");
    const returnUrl = `${protocol}://${host}/receipt/${invoice.id}`;

    const session = await createPaymentSession(
        total,
        "USD",
        invoice.id,
        returnUrl,
        resolvedContact.email,
        adyenLineItems
    );

    return NextResponse.json({
        sessionId: session.id,
        sessionData: session.sessionData,
        invoiceId: invoice.id,
        taxRate,
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
