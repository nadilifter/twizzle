import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createPaymentSession, type AdyenLineItem } from "@/lib/adyen";
import { calculateAge, isAgeEligible } from "@/lib/age-utils";
import { subDays } from "date-fns";
import { getAuthSession } from "@/lib/auth";
import { resolveOrProvisionCheckoutUser } from "@/lib/checkout-user-provisioning";
import { checkApiRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getRegistrationStatus } from "@/lib/registration-utils";
import { calculateBulkDiscounts } from "@/lib/bulk-discounts";
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
  details: z
    .object({
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
      earlyAccessCode: z.string().optional(),
      variantId: z.string().optional(),
      variantLabel: z.string().optional(),
      typeName: z.string().optional(),
    })
    .optional(),
});

const checkoutBodySchema = z
  .object({
    items: z.array(cartItemSchema).min(1).max(100),

    // Who is placing the order
    contact: z.object({
      firstName: z.string().min(1, "First name is required").max(255),
      lastName: z.string().min(1, "Last name is required").max(255),
      email: z.string().email("Please enter a valid email address").max(320),
      phone: z
        .string()
        .min(1, "Phone number is required")
        .max(30)
        .refine((val) => isValidPhoneNumber(val), "Please enter a valid phone number"),
    }),

    // Billing address — required unless billingAddressId references a saved record
    billingAddress: z
      .object({
        firstName: z.string().min(1, "Billing first name is required").max(255),
        lastName: z.string().min(1, "Billing last name is required").max(255),
        street: z.string().min(1, "Street address is required").max(500),
        city: z.string().min(1, "City is required").max(255),
        stateProvince: z.string().max(255).default(""),
        postalCode: z.string().min(1, "Postal code is required").max(20),
        country: z.literal("US", { error: "Country must be US" }),
      })
      .optional(),

    // Shipping address — only required when cart contains physical store items
    shippingAddress: z
      .object({
        street: z.string().min(1, "Shipping street is required").max(500),
        city: z.string().min(1, "Shipping city is required").max(255),
        stateProvince: z.string().max(255).default(""),
        postalCode: z.string().min(1, "Shipping postal code is required").max(20),
        country: z.string().max(10).default("US"),
      })
      .optional(),

    contactId: z.string().optional(),
    billingAddressId: z.string().optional(),
    editingAddress: z.boolean().optional(),
    discountCode: z.string().max(100).optional(),
  })
  .superRefine((data, ctx) => {
    const hasPhysical = data.items.some((i) => i.type === "item");
    if (hasPhysical && !data.shippingAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Shipping address is required for orders containing store items",
        path: ["shippingAddress"],
      });
    }
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
    earlyAccessCode?: string;
    variantId?: string;
    variantLabel?: string;
    typeName?: string;
  };
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const rateLimitResponse = await checkApiRateLimit(request, "checkout", RATE_LIMITS.sensitive);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const parsed = checkoutBodySchema.safeParse(body);
    if (!parsed.success) {
      const details: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (path && !details[path]) details[path] = issue.message;
      }
      return NextResponse.json({ error: "Invalid request data", details }, { status: 400 });
    }
    const {
      items: validatedItems,
      contact,
      billingAddress: billingAddressInput,
      shippingAddress,
      contactId,
      billingAddressId,
      editingAddress,
      discountCode,
    } = parsed.data;
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
      include: {
        organization: {
          include: {
            subscription: {
              select: {
                plan: {
                  select: {
                    transactionFee: true,
                    perTransactionFee: true,
                  },
                },
              },
            },
            adyenPlatformAccount: { select: { storeReference: true } },
          },
        },
      },
    });

    if (!config) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const organizationId = config.organizationId;

    // Resolve auth session once (avoids repeated DB lookups across validation steps)
    let authUserId = (await getAuthSession())?.user?.id || null;

    // Used to decide whether to pass shopper tokenization options to Adyen.
    const hasAuthSession = !!authUserId;

    // For guest checkouts, resolve or provision a user account by email.
    // This links the invoice, contact, address, and Adyen tokenization to a real user.
    if (!authUserId) {
      try {
        const { userId } = await resolveOrProvisionCheckoutUser({
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          organizationId,
        });
        authUserId = userId;
      } catch (err) {
        console.error("checkout/session: failed to resolve/provision user:", err, contact);
        // Continue as anonymous guest — no regression in checkout flow
      }
    }

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
      const allRequiredWaiverIds = [
        ...new Set(
          programItems.flatMap((item: CartItem) => {
            const pId = item.details?.programId || item.referenceId;
            return programWaiverMap[pId] || [];
          })
        ),
      ];

      if (allRequiredWaiverIds.length > 0) {
        if (!authUserId) {
          const firstItem = programItems.find((item: CartItem) => {
            const pId = item.details?.programId || item.referenceId;
            return (programWaiverMap[pId] || []).length > 0;
          });
          return NextResponse.json(
            {
              error: `Required waivers have not been signed for athlete ${firstItem?.athleteName || firstItem?.athleteId || firstItem?.details?.athleteId}. Please sign all waivers before proceeding to payment.`,
            },
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
              {
                error: `Required waivers have not been signed for athlete ${item.athleteName || athleteId}. Please sign all waivers before proceeding to payment.`,
              },
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

      const [
        programsWithMedical,
        programsWithFiles,
        programsWithMembership,
        programsForRegCheck,
        programsWithGender,
      ] = await Promise.all([
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
        db.program.findMany({
          where: { id: { in: programIds }, organizationId },
          select: {
            id: true,
            name: true,
            registrationOpen: true,
            registrationStartDate: true,
            registrationStartTime: true,
            registrationEndDate: true,
            registrationEndTime: true,
            earlyAccessCode: true,
          },
        }),
        db.program.findMany({
          where: { id: { in: programIds }, organizationId, hasGenderRestriction: true },
          select: { id: true, name: true, allowedGenders: true },
        }),
      ]);

      // Registration window check — fail fast before validating requirements
      for (const prog of programsForRegCheck) {
        const status = getRegistrationStatus(prog);
        if (status === "open") continue;

        const cartItemsForProgram = programItems.filter(
          (item: CartItem) => (item.details?.programId || item.referenceId) === prog.id
        );
        for (const item of cartItemsForProgram) {
          const code = item.details?.earlyAccessCode;
          const hasValidCode = code && prog.earlyAccessCode && code === prog.earlyAccessCode;
          if (!hasValidCode) {
            const reason =
              status === "closed" ? "Registration has closed" : "Registration is not yet open";
            return NextResponse.json({ error: `${reason} for "${prog.name}".` }, { status: 400 });
          }
        }
      }

      // Gender restriction check
      if (programsWithGender.length > 0) {
        const genderProgramMap = new Map(programsWithGender.map((p) => [p.id, p]));

        const genderCheckPairs: { athleteId: string; programId: string; athleteLabel: string }[] =
          [];
        for (const item of programItems) {
          const pid = item.details?.programId || item.referenceId;
          const athleteId = item.athleteId || item.details?.athleteId;
          if (!pid || !athleteId || !genderProgramMap.has(pid)) continue;
          genderCheckPairs.push({
            athleteId,
            programId: pid,
            athleteLabel: item.athleteName || athleteId,
          });
        }

        if (genderCheckPairs.length > 0) {
          const uniqueAthleteIds = [...new Set(genderCheckPairs.map((p) => p.athleteId))];
          const athletes = await db.athlete.findMany({
            where: { id: { in: uniqueAthleteIds } },
            select: { id: true, gender: true },
          });
          const athleteGenderMap = new Map(athletes.map((a) => [a.id, a.gender]));

          for (const { athleteId, programId, athleteLabel } of genderCheckPairs) {
            const prog = genderProgramMap.get(programId)!;
            if (prog.allowedGenders.length === 0) continue;
            const athleteGender = athleteGenderMap.get(athleteId);
            if (!athleteGender || !prog.allowedGenders.includes(athleteGender)) {
              return NextResponse.json(
                {
                  error: `Athlete "${athleteLabel}" does not meet the gender requirement for "${prog.name}".`,
                },
                { status: 400 }
              );
            }
          }
        }
      }

      // Medical info check (already batched)
      if (programsWithMedical.length > 0) {
        const medicalProgramIds = new Set(programsWithMedical.map((p) => p.id));
        const athleteIds = [
          ...new Set(
            programItems
              .filter((item: CartItem) => {
                const pid = item.details?.programId || item.referenceId;
                return pid && medicalProgramIds.has(pid);
              })
              .map((item: CartItem) => item.athleteId || item.details?.athleteId)
              .filter(Boolean) as string[]
          ),
        ];

        if (athleteIds.length > 0) {
          const medicalInfoRecords = await db.athleteMedicalInfo.findMany({
            where: { athleteId: { in: athleteIds } },
            select: { athleteId: true },
          });

          const athletesWithMedical = new Set(medicalInfoRecords.map((r) => r.athleteId));
          const athletesMissing = athleteIds.filter((id) => !athletesWithMedical.has(id));

          if (athletesMissing.length > 0) {
            return NextResponse.json(
              {
                error:
                  "Medical information is required for all athletes. Please complete the medical information forms before proceeding to payment.",
              },
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
          .filter((p) => !!(p.programId && fileProgramIds.has(p.programId) && p.athleteId)) as {
          programId: string;
          athleteId: string;
          athleteName: string | undefined;
        }[];

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
                {
                  error: `A required file upload is missing for ${pair.athleteName || "an athlete"}. Please complete the file upload step before proceeding.`,
                },
                { status: 400 }
              );
            }
          }
        }
      }

      // Membership requirement check — single batch query instead of per-item
      if (programsWithMembership.length > 0) {
        const membershipProgramMap = new Map(programsWithMembership.map((p) => [p.id, p]));

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
            const hasActiveMembership = requiredIds.some((rid) =>
              membershipSet.has(`${athleteId}:${rid}`)
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
                  {
                    error: `Athlete "${athleteLabel}" does not have the required membership for "${prog.name}". Please add the membership to your cart or contact the organization.`,
                  },
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
            {
              error: `Membership "${item.name}" is not currently available for purchase (status: ${instance.status}).`,
            },
            { status: 400 }
          );
        }

        // Check purchase window
        const purchaseStart =
          instance.purchaseStartDate ??
          (instance.group.purchaseWindowDays != null
            ? subDays(instance.startDate, instance.group.purchaseWindowDays)
            : new Date(0));
        const purchaseEnd = instance.purchaseEndDate ?? instance.endDate;

        if (now < purchaseStart || now > purchaseEnd) {
          return NextResponse.json(
            { error: `Membership "${item.name}" is not within its purchase window.` },
            { status: 400 }
          );
        }

        // Registration window check (additional gate alongside legacy purchase window)
        if (
          instance.registrationStartDate ||
          instance.registrationEndDate ||
          !instance.registrationOpen
        ) {
          const memRegStatus = getRegistrationStatus(instance);
          if (memRegStatus !== "open") {
            const code = item.details?.earlyAccessCode;
            const hasValidCode =
              code && instance.earlyAccessCode && code === instance.earlyAccessCode;
            if (!hasValidCode) {
              const reason =
                memRegStatus === "closed"
                  ? "Registration has closed"
                  : "Registration is not yet open";
              return NextResponse.json(
                { error: `${reason} for membership "${instance.name}".` },
                { status: 400 }
              );
            }
          }
        }

        // Check capacity
        if (instance.group.hasCapacityRestriction) {
          const effectiveCapacity = instance.capacity ?? instance.group.capacity;
          if (
            effectiveCapacity != null &&
            instance._count.athleteMemberships >= effectiveCapacity
          ) {
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
              {
                error: `Athlete "${athleteLabel}" already has an active membership for "${item.name}".`,
              },
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
                {
                  error: `Athlete "${athleteLabel}" does not meet the gender requirement for "${item.name}".`,
                },
                { status: 400 }
              );
            }
          }

          // Age restriction
          if (instance.group.hasAgeRestriction) {
            const age = calculateAge(athlete.birthDate);
            if (!isAgeEligible(age, instance.group.minAge, instance.group.maxAge)) {
              return NextResponse.json(
                {
                  error: `Athlete "${athleteLabel}" does not meet the age requirement for "${item.name}" (ages ${instance.group.minAge ?? 0}-${instance.group.maxAge ?? "any"}).`,
                },
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
                {
                  error: `Athlete "${athleteLabel}" does not meet the level requirement for "${item.name}".`,
                },
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
                  {
                    error: `Required waivers have not been signed for athlete "${athleteLabel}" for membership "${item.name}". Please sign all waivers before proceeding to payment.`,
                  },
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
                {
                  error: `Medical information is required for athlete "${athleteLabel}" for membership "${item.name}". Please complete the medical information form before proceeding to payment.`,
                },
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

        // Capacity pre-check (authoritative check with row-level locking happens in processInvoiceRegistrations)
        if (competition.hasCapacityRestriction && competition.capacity != null) {
          const currentEntries = await db.competitionEntry.count({
            where: {
              competitionId: compId,
              status: { notIn: ["WITHDRAWN", "REJECTED"] },
            },
          });
          if (currentEntries >= competition.capacity) {
            return NextResponse.json(
              { error: `Competition "${competition.name}" has reached its capacity limit.` },
              { status: 400 }
            );
          }
        }

        const compRegStatus = getRegistrationStatus(competition);
        if (compRegStatus !== "open") {
          const code = item.details?.earlyAccessCode;
          const hasValidCode =
            code && competition.earlyAccessCode && code === competition.earlyAccessCode;
          if (!hasValidCode) {
            const reason =
              compRegStatus === "closed"
                ? "Registration has closed"
                : "Registration is not yet open";
            return NextResponse.json(
              { error: `${reason} for "${competition.name}".` },
              { status: 400 }
            );
          }
        }

        // Verify all requested categories exist and are active
        if (competition.categories.length !== categoryIds.length) {
          return NextResponse.json(
            {
              error: `One or more selected events are no longer available for "${competition.name}".`,
            },
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
              {
                error: `Athlete "${athleteLabel}" does not meet the age requirement for "${competition.name}".`,
              },
              { status: 400 }
            );
          }
        }

        if (competition.hasLevelRestriction && competition.levelRequirementIds.length > 0) {
          const cAthleteLevel = athlete.organizationAthletes[0]?.level ?? null;
          if (!cAthleteLevel || !competition.levelRequirementIds.includes(cAthleteLevel)) {
            return NextResponse.json(
              {
                error: `Athlete "${athleteLabel}" does not meet the level requirement for "${competition.name}".`,
              },
              { status: 400 }
            );
          }
        }

        if (
          competition.hasMembershipRestriction &&
          competition.membershipRequirementIds.length > 0
        ) {
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
                {
                  error: `Athlete "${athleteLabel}" does not have the required membership for "${competition.name}".`,
                },
                { status: 400 }
              );
            }
          }
        }

        // Waiver verification for competition
        if (competition.hasWaiverRestriction && competition.waiverRequirementIds.length > 0) {
          if (!authUserId) {
            return NextResponse.json(
              {
                error: `Required waivers have not been signed for athlete ${athleteLabel} for "${competition.name}". Please sign all waivers before proceeding.`,
              },
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
              {
                error: `Required waivers have not been signed for athlete ${athleteLabel} for "${competition.name}". Please sign all waivers before proceeding.`,
              },
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
              {
                error: `Medical information is required for athlete ${athleteLabel} for "${competition.name}". Please complete the medical form before proceeding.`,
              },
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
              {
                error: `A required file upload is missing for athlete ${athleteLabel} for "${competition.name}". Please complete the file upload step before proceeding.`,
              },
              { status: 400 }
            );
          }
        }

        // Category-level age + gender eligibility
        for (const cat of competition.categories) {
          if (cat.ageCategory) {
            if (!isAgeEligible(age, cat.ageCategory.minAge, cat.ageCategory.maxAge)) {
              return NextResponse.json(
                {
                  error: `Athlete "${athleteLabel}" is not eligible for one of the selected events in "${competition.name}".`,
                },
                { status: 400 }
              );
            }
          }

          // Gender check from individual entry template
          if (
            cat.individualEntry?.hasGenderRestriction &&
            cat.individualEntry.allowedGenders.length > 0
          ) {
            if (!athlete.gender || !cat.individualEntry.allowedGenders.includes(athlete.gender)) {
              return NextResponse.json(
                {
                  error: `Athlete "${athleteLabel}" does not meet the gender requirement for one of the selected events in "${competition.name}".`,
                },
                { status: 400 }
              );
            }
          }

          // Gender check from combination entry template (restriction axis)
          if (cat.combinationEntry) {
            const axis = cat.combinationEntry.template?.restrictionAxis;
            const restrictionValue =
              axis === "ROW"
                ? cat.combinationEntry.rowValue
                : axis === "COLUMN"
                  ? cat.combinationEntry.colValue
                  : null;
            if (restrictionValue && restrictionValue.allowedGenders.length > 0) {
              if (!athlete.gender || !restrictionValue.allowedGenders.includes(athlete.gender)) {
                return NextResponse.json(
                  {
                    error: `Athlete "${athleteLabel}" does not meet the gender requirement for one of the selected events in "${competition.name}".`,
                  },
                  { status: 400 }
                );
              }
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
            {
              error: `Athlete "${athleteLabel}" is already registered for one or more selected events in "${competition.name}".`,
            },
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
              if (
                eventCount >= tier.minEvents &&
                (tier.maxEvents === null || eventCount <= tier.maxEvents)
              ) {
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

    // 2e. Server-side event gender restriction validation
    const eventItems = items.filter((item: CartItem) => item.type === "event");
    if (eventItems.length > 0) {
      const eventIds = eventItems.map((item: CartItem) => item.referenceId).filter(Boolean);
      const eventsWithGender = await db.event.findMany({
        where: { id: { in: eventIds }, organizationId, hasGenderRestriction: true },
        select: { id: true, title: true, allowedGenders: true },
      });

      if (eventsWithGender.length > 0) {
        const eventGenderMap = new Map(eventsWithGender.map((e) => [e.id, e]));
        const genderCheckPairs: { athleteId: string; eventId: string; athleteLabel: string }[] = [];

        for (const item of eventItems) {
          const eventId = item.referenceId;
          const athleteId = item.athleteId || item.details?.athleteId;
          if (!eventId || !athleteId || !eventGenderMap.has(eventId)) continue;
          genderCheckPairs.push({
            athleteId,
            eventId,
            athleteLabel: item.athleteName || athleteId,
          });
        }

        if (genderCheckPairs.length > 0) {
          const uniqueAthleteIds = [...new Set(genderCheckPairs.map((p) => p.athleteId))];
          const eventAthletes = await db.athlete.findMany({
            where: { id: { in: uniqueAthleteIds } },
            select: { id: true, gender: true },
          });
          const athleteGenderMap = new Map(eventAthletes.map((a) => [a.id, a.gender]));

          for (const { athleteId, eventId, athleteLabel } of genderCheckPairs) {
            const evt = eventGenderMap.get(eventId)!;
            if (evt.allowedGenders.length === 0) continue;
            const athleteGender = athleteGenderMap.get(athleteId);
            if (!athleteGender || !evt.allowedGenders.includes(athleteGender)) {
              return NextResponse.json(
                {
                  error: `Athlete "${athleteLabel}" does not meet the gender requirement for "${evt.title}".`,
                },
                { status: 400 }
              );
            }
          }
        }
      }
    }

    // 2f. Server-side pass gender restriction validation
    const passItems = items.filter((item: CartItem) => item.type === "pass");
    if (passItems.length > 0) {
      const passIds = passItems
        .map((item: CartItem) => item.details?.passId || item.referenceId)
        .filter(Boolean);
      const passesWithGender = await db.pass.findMany({
        where: { id: { in: passIds }, organizationId, hasGenderRestriction: true },
        select: { id: true, name: true, allowedGenders: true },
      });

      if (passesWithGender.length > 0) {
        const passGenderMap = new Map(passesWithGender.map((p) => [p.id, p]));
        const passGenderCheckPairs: { athleteId: string; passId: string; athleteLabel: string }[] =
          [];

        for (const item of passItems) {
          const pId = item.details?.passId || item.referenceId;
          const athleteId = item.athleteId || item.details?.athleteId;
          if (!pId || !athleteId || !passGenderMap.has(pId)) continue;
          passGenderCheckPairs.push({
            athleteId,
            passId: pId,
            athleteLabel: item.athleteName || athleteId,
          });
        }

        if (passGenderCheckPairs.length > 0) {
          const uniqueAthleteIds = [...new Set(passGenderCheckPairs.map((p) => p.athleteId))];
          const passAthletes = await db.athlete.findMany({
            where: { id: { in: uniqueAthleteIds } },
            select: { id: true, gender: true },
          });
          const athleteGenderMap = new Map(passAthletes.map((a) => [a.id, a.gender]));

          for (const { athleteId, passId, athleteLabel } of passGenderCheckPairs) {
            const p = passGenderMap.get(passId)!;
            if (p.allowedGenders.length === 0) continue;
            const athleteGender = athleteGenderMap.get(athleteId);
            if (!athleteGender || !p.allowedGenders.includes(athleteGender)) {
              return NextResponse.json(
                {
                  error: `Athlete "${athleteLabel}" does not meet the gender requirement for "${p.name}".`,
                },
                { status: 400 }
              );
            }
          }
        }
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
    const programPriceMap = new Map<
      string,
      {
        id: string;
        basePrice: any;
        perSessionPrice: any;
        pricingModel: string;
        billingInterval: string;
        recurringPrice: any;
      }
    >();
    if (programItemsForPrice.length > 0) {
      const allProgramIds = [
        ...new Set(
          programItemsForPrice
            .map(({ item }) => item.details?.programId || item.referenceId)
            .filter(Boolean)
        ),
      ] as string[];
      const allInstanceIds = [
        ...new Set(
          programItemsForPrice
            .map(({ item }) => item.details?.instanceId)
            .filter(Boolean) as string[]
        ),
      ];
      const [programsForPrice, programInstances] = await Promise.all([
        db.program.findMany({
          where: { id: { in: allProgramIds }, organizationId },
          select: {
            id: true,
            basePrice: true,
            perSessionPrice: true,
            pricingModel: true,
            billingInterval: true,
            recurringPrice: true,
          },
        }),
        allInstanceIds.length > 0
          ? db.programInstance.findMany({
              where: { id: { in: allInstanceIds }, organizationId },
              select: { id: true, programId: true },
            })
          : Promise.resolve([]),
      ]);
      for (const p of programsForPrice) {
        programPriceMap.set(p.id, p);
      }
      const instanceProgramMap = new Map(programInstances.map((i) => [i.id, i.programId]));
      for (const { item } of programItemsForPrice) {
        if (!item.details?.instanceId) continue;
        const serverProgramId = instanceProgramMap.get(item.details.instanceId);
        if (!serverProgramId || serverProgramId !== item.details?.programId) {
          return NextResponse.json(
            { error: `Invalid session for "${item.name}".` },
            { status: 400 }
          );
        }
      }
      for (const { item, index } of programItemsForPrice) {
        const programId = item.details?.programId || item.referenceId;
        const prog = programPriceMap.get(programId);
        if (prog) {
          let price: number;
          if (prog.billingInterval !== "ONE_TIME" && prog.recurringPrice) {
            // Recurring program: charge only the first period at checkout
            price = Number(prog.recurringPrice);
          } else if (prog.pricingModel === "PER_SESSION") {
            price = Number(prog.perSessionPrice ?? 0);
          } else {
            price = Number(prog.basePrice ?? 0);
          }
          serverPrices.set(index, price * item.quantity);
        }
      }
    }

    // Verify membership prices
    const membershipItemsForPrice = items
      .map((item: CartItem, index: number) => ({ item, index }))
      .filter(({ item }) => item.type === "membership");
    if (membershipItemsForPrice.length > 0) {
      const allMembershipIds = [
        ...new Set(
          membershipItemsForPrice
            .map(({ item }) => item.details?.membershipInstanceId || item.referenceId)
            .filter(Boolean)
        ),
      ] as string[];
      const instancesForPrice = await db.membershipInstance.findMany({
        where: { id: { in: allMembershipIds } },
        select: { id: true, price: true },
      });
      const membershipPriceMap = new Map(instancesForPrice.map((m) => [m.id, Number(m.price)]));
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
      const allPassIds = [
        ...new Set(
          passItemsForPrice
            .map(({ item }) => item.details?.passId || item.referenceId)
            .filter(Boolean)
        ),
      ] as string[];
      const passesForPrice = await db.pass.findMany({
        where: { id: { in: allPassIds }, organizationId },
        select: { id: true, price: true },
      });
      const passPriceMap = new Map(passesForPrice.map((p) => [p.id, Number(p.price)]));
      for (const { item, index } of passItemsForPrice) {
        const passId = item.details?.passId || item.referenceId;
        const price = passPriceMap.get(passId);
        if (price !== undefined) {
          serverPrices.set(index, price * item.quantity);
        }
      }
    }

    // Verify product (store item) prices and inventory (including variants)
    const productItemsForPrice = items
      .map((item: CartItem, index: number) => ({ item, index }))
      .filter(({ item }) => item.type === "item");
    if (productItemsForPrice.length > 0) {
      const allProductIds = [
        ...new Set(productItemsForPrice.map(({ item }) => item.referenceId).filter(Boolean)),
      ] as string[];
      const productsForPrice = await db.product.findMany({
        where: { id: { in: allProductIds }, organizationId, isActive: true },
        select: {
          id: true,
          price: true,
          currentInventory: true,
          name: true,
          typeName: true,
          variants: {
            select: { id: true, label: true, price: true, currentInventory: true, isActive: true },
          },
        },
      });
      const productPriceMap = new Map(productsForPrice.map((p) => [p.id, p]));

      for (const { item, index } of productItemsForPrice) {
        const product = productPriceMap.get(item.referenceId);
        if (!product) {
          return NextResponse.json(
            { error: `Product "${item.name}" is no longer available` },
            { status: 400 }
          );
        }

        const variantId = item.details?.variantId as string | undefined;
        if (variantId) {
          const variant = product.variants.find((v) => v.id === variantId);
          if (!variant || !variant.isActive) {
            return NextResponse.json(
              { error: `Variant for "${item.name}" is no longer available` },
              { status: 400 }
            );
          }
          const unitPrice = variant.price !== null ? Number(variant.price) : Number(product.price);
          serverPrices.set(index, unitPrice * item.quantity);

          if (variant.currentInventory !== null && variant.currentInventory < item.quantity) {
            return NextResponse.json(
              {
                error: `Insufficient stock for "${product.name}" (${variant.label}). Only ${variant.currentInventory} available.`,
              },
              { status: 400 }
            );
          }
        } else {
          serverPrices.set(index, Number(product.price) * item.quantity);

          if (product.currentInventory !== null && product.currentInventory < item.quantity) {
            return NextResponse.json(
              {
                error: `Insufficient stock for "${product.name}". Only ${product.currentInventory} available.`,
              },
              { status: 400 }
            );
          }
        }
      }
    }

    // Calculate totals using server-verified prices
    const taxRate =
      config.organization.taxEnabled !== false ? Number(config.organization.taxRate ?? 0) : 0;

    const subtotal = items.reduce((sum: number, item: CartItem, index: number) => {
      if (serverPrices.has(index)) {
        return sum + serverPrices.get(index)!;
      }
      return sum + Number(item.price) * item.quantity;
    }, 0);
    // 3b. Calculate bulk registration discounts (server-verified)
    const bulkDiscountProgramIds = [
      ...new Set(
        items
          .filter((i: CartItem) => i.type === "program" && i.details?.programId)
          .map((i: CartItem) => i.details!.programId as string)
      ),
    ];
    let bulkDiscountLineAmount = 0;
    if (bulkDiscountProgramIds.length > 0) {
      const programBulkDiscounts = await db.programBulkDiscount.findMany({
        where: { programId: { in: bulkDiscountProgramIds }, program: { organizationId } },
      });
      const bulkDiscountsByProgramId = new Map(
        bulkDiscountProgramIds.map((id) => [
          id,
          programBulkDiscounts
            .filter((d) => d.programId === id)
            .map((d) => ({
              id: d.id,
              type: d.type,
              minQuantity: d.minQuantity,
              discountType: d.discountType,
              discountValue: Number(d.discountValue),
            })),
        ])
      );
      const { totalDiscount } = calculateBulkDiscounts(
        items,
        bulkDiscountsByProgramId,
        (index, item) =>
          serverPrices.has(index) ? serverPrices.get(index)! : Number(item.price) * item.quantity
      );
      bulkDiscountLineAmount = totalDiscount;
    }

    // 3c. Validate and apply discount code
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
          discount.status !== "DRAFT" && validFrom <= now && (!validTo || validTo >= now);

        if (isValid) {
          // Atomically claim a usage slot: increment only if under the limit
          let usageClaimed = true;
          if (discount.usageLimit) {
            const claimed = await db.$executeRaw(
              Prisma.sql`UPDATE "Discount" SET "usageCount" = "usageCount" + 1 WHERE id = ${discount.id} AND "usageCount" < ${discount.usageLimit}`
            );
            usageClaimed = claimed > 0;
          } else {
            await db.discount.update({
              where: { id: discount.id },
              data: { usageCount: { increment: 1 } },
            });
          }

          if (usageClaimed) {
            discountRecord = {
              id: discount.id,
              type: discount.type,
              amount: discount.amount,
              name: discount.name,
            };
            if (discount.type === "PERCENTAGE") {
              discountLineAmount =
                Math.round(((subtotal * Number(discount.amount)) / 100) * 100) / 100;
            } else {
              discountLineAmount =
                Math.round(Math.min(Number(discount.amount), subtotal) * 100) / 100;
            }
          }
        }
      }
    }

    const discountedSubtotal = Math.max(subtotal - discountLineAmount - bulkDiscountLineAmount, 0);
    const tax = Math.round(discountedSubtotal * taxRate * 100) / 100;

    const taxPaidBy = config.organization.taxPaidBy;
    const plan = config.organization.subscription?.plan;
    const planTransactionFee = plan ? Number(plan.transactionFee) : 0;
    const planPerTransactionFee = plan ? Number(plan.perTransactionFee) : 0;

    // Calculate processing fee based on the amount the customer is paying
    const feeBase = taxPaidBy === "CUSTOMER" ? discountedSubtotal + tax : discountedSubtotal;
    const processingFeeRaw = feeBase > 0 ? feeBase * planTransactionFee + planPerTransactionFee : 0;
    const processingFee = Math.round(processingFeeRaw * 100) / 100;

    let total = discountedSubtotal;
    if (taxPaidBy === "CUSTOMER") total += tax;
    total = Math.round(total * 100) / 100;

    // Billing address is required for paid orders — validated here using server-computed total.
    // We don't use client-submitted flags; we check the actual data.
    if (total > 0) {
      const hasSavedAddress = !!billingAddressId;
      const hasFormAddress = !!(
        billingAddressInput?.street &&
        billingAddressInput?.city &&
        billingAddressInput?.postalCode
      );
      if (!hasSavedAddress && !hasFormAddress) {
        return NextResponse.json(
          {
            error: "Invalid request data",
            details: { billingAddress: "Full billing address is required" },
          },
          { status: 400 }
        );
      }
    }

    // 4. Resolve contact and billing address
    // Contact: use saved record if contactId provided, else use submitted contact fields
    let resolvedContact = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
    };

    if (contactId) {
      if (authUserId) {
        const savedContact = await db.userContact.findFirst({
          where: { id: contactId, userId: authUserId },
        });
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

    // Billing address: use saved record if billingAddressId provided, else use submitted billingAddress
    let resolvedAddress = {
      street: billingAddressInput?.street || "",
      city: billingAddressInput?.city || "",
      stateProvince: billingAddressInput?.stateProvince || "",
      postalCode: billingAddressInput?.postalCode || "",
    };

    if (billingAddressId) {
      if (editingAddress) {
        if (!authUserId) {
          return NextResponse.json(
            { error: "Authentication required to update address" },
            { status: 401 }
          );
        }
        const ownedAddress = await db.userBillingAddress.findFirst({
          where: { id: billingAddressId, userId: authUserId },
        });
        if (ownedAddress) {
          if (
            billingAddressInput?.street &&
            billingAddressInput?.city &&
            billingAddressInput?.postalCode
          ) {
            await db.userBillingAddress.update({
              where: { id: billingAddressId, userId: authUserId },
              data: {
                street: billingAddressInput.street,
                city: billingAddressInput.city,
                stateProvince: billingAddressInput.stateProvince || null,
                postalCode: billingAddressInput.postalCode,
              },
            });
          } else {
            resolvedAddress = {
              street: ownedAddress.street,
              city: ownedAddress.city,
              stateProvince: ownedAddress.stateProvince || "",
              postalCode: ownedAddress.postalCode,
            };
          }
        } else if (
          billingAddressInput?.street &&
          billingAddressInput?.city &&
          billingAddressInput?.postalCode
        ) {
          await db.userBillingAddress.create({
            data: {
              userId: authUserId,
              street: billingAddressInput.street,
              city: billingAddressInput.city,
              stateProvince: billingAddressInput.stateProvince || null,
              postalCode: billingAddressInput.postalCode,
            },
          });
        }
      } else {
        if (authUserId) {
          const savedAddress = await db.userBillingAddress.findFirst({
            where: { id: billingAddressId, userId: authUserId },
          });
          if (savedAddress) {
            resolvedAddress = {
              street: savedAddress.street,
              city: savedAddress.city,
              stateProvince: savedAddress.stateProvince || "",
              postalCode: savedAddress.postalCode,
            };
          } else if (
            !billingAddressInput?.street ||
            !billingAddressInput?.city ||
            !billingAddressInput?.postalCode
          ) {
            return NextResponse.json(
              { error: "Billing address not found and no address provided" },
              { status: 400 }
            );
          }
        }
      }
    }

    // Save new contacts and addresses to the User profile (run in parallel)
    if (authUserId) {
      await Promise.all([
        !contactId && resolvedContact.firstName && resolvedContact.email
          ? (async () => {
              const existing = await db.userContact.findFirst({
                where: { userId: authUserId, email: resolvedContact.email },
              });
              if (!existing) {
                const count = await db.userContact.count({ where: { userId: authUserId } });
                await db.userContact.create({
                  data: {
                    userId: authUserId,
                    firstName: resolvedContact.firstName,
                    lastName: resolvedContact.lastName,
                    email: resolvedContact.email,
                    phone: resolvedContact.phone,
                    relationship: "Self",
                    isPrimary: count === 0,
                  },
                });
              }
            })()
          : Promise.resolve(),
        !billingAddressId && resolvedAddress.street
          ? (async () => {
              const existing = await db.userBillingAddress.findFirst({
                where: {
                  userId: authUserId,
                  street: resolvedAddress.street,
                  city: resolvedAddress.city,
                  postalCode: resolvedAddress.postalCode,
                },
              });
              if (!existing) {
                const count = await db.userBillingAddress.count({ where: { userId: authUserId } });
                await db.userBillingAddress.create({
                  data: {
                    userId: authUserId,
                    label: "Home",
                    street: resolvedAddress.street,
                    city: resolvedAddress.city,
                    stateProvince: resolvedAddress.stateProvince || null,
                    postalCode: resolvedAddress.postalCode,
                    country: "US",
                    isPrimary: count === 0,
                  },
                });
              }
            })()
          : Promise.resolve(),
      ]);
    }

    // 5. Create Invoice with metadata for post-payment processing
    const membershipInvoiceItems = items.filter((item: CartItem) => item.type === "membership");
    const passInvoiceItems = items.filter((item: CartItem) => item.type === "pass");

    // Build metadata for webhook processing
    const invoiceMetadata = {
      membershipPurchases: membershipInvoiceItems.map((item) => ({
        membershipInstanceId: item.details?.membershipInstanceId || item.referenceId,
        athleteId: item.athleteId || item.details?.athleteId,
        quantity: item.quantity,
      })),
      passPurchases: passInvoiceItems.map((item) => ({
        passId: item.details?.passId || item.referenceId,
        athleteId: item.athleteId || item.details?.athleteId,
        billingInterval: item.details?.billingInterval,
      })),
      programRegistrations: programItems.map((item) => ({
        programId: item.details?.programId,
        instanceId: item.details?.instanceId,
        athleteId: item.athleteId || item.details?.athleteId,
        waitlist: item.details?.waitlist ?? false,
        requiredMemberships: item.details?.requiredMemberships || [],
      })),
      competitionRegistrations: competitionItems.map((item) => ({
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
        processingFee,
        total,
        status: "DRAFT",
        dueDate: new Date(),
        notes: JSON.stringify(invoiceMetadata),
      },
    });

    // 6. Resolve GL codes and product data for line items (all queries run in parallel)
    const glCodeMap = new Map<string, string | null>();
    const glProgramIds = items
      .filter((i: CartItem) => i.type === "program" && i.details?.programId)
      .map((i: CartItem) => i.details!.programId!);
    const glPassIds = items
      .filter((i: CartItem) => i.type === "pass")
      .map((i: CartItem) => i.details?.passId || i.referenceId)
      .filter(Boolean);
    const glCompetitionIds = items
      .filter((i: CartItem) => i.type === "competition")
      .map((i: CartItem) => i.details?.competitionId || i.referenceId)
      .filter(Boolean);
    const glMembershipInstanceIds = items
      .filter((i: CartItem) => i.type === "membership")
      .map((i: CartItem) => i.details?.membershipInstanceId || i.referenceId)
      .filter(Boolean);
    const productItemIds = items
      .filter((i: CartItem) => i.type === "item")
      .map((i: CartItem) => i.referenceId);

    const [glPrograms, glPasses, glComps, glInstances, defaultCodes, storeProducts] =
      await Promise.all([
        glProgramIds.length > 0
          ? db.program.findMany({
              where: { id: { in: glProgramIds } },
              select: { id: true, glCodeId: true },
            })
          : [],
        glPassIds.length > 0
          ? db.pass.findMany({
              where: { id: { in: glPassIds as string[] } },
              select: { id: true, glCodeId: true },
            })
          : [],
        glCompetitionIds.length > 0
          ? db.competition.findMany({
              where: { id: { in: glCompetitionIds as string[] } },
              select: { id: true, glCodeId: true },
            })
          : [],
        glMembershipInstanceIds.length > 0
          ? db.membershipInstance.findMany({
              where: { id: { in: glMembershipInstanceIds as string[] } },
              select: { id: true, group: { select: { glCodeId: true } } },
            })
          : [],
        db.gLCode.findMany({
          where: { organizationId, isDefault: true, defaultForType: { not: null } },
          select: { id: true, defaultForType: true },
        }),
        productItemIds.length > 0
          ? db.product.findMany({
              where: { id: { in: productItemIds }, organizationId },
              select: { id: true, sku: true, imageUrl: true, glCodeId: true },
            })
          : [],
      ]);

    const productMap = new Map(storeProducts.map((p) => [p.id, p]));

    for (const p of glPrograms) if (p.glCodeId) glCodeMap.set(`program:${p.id}`, p.glCodeId);
    for (const p of glPasses) if (p.glCodeId) glCodeMap.set(`pass:${p.id}`, p.glCodeId);
    for (const c of glComps) if (c.glCodeId) glCodeMap.set(`competition:${c.id}`, c.glCodeId);
    for (const i of glInstances)
      if (i.group.glCodeId) glCodeMap.set(`membership:${i.id}`, i.group.glCodeId);
    for (const p of storeProducts) if (p.glCodeId) glCodeMap.set(`item:${p.id}`, p.glCodeId);

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
        if (item.type === "program")
          glCodeId = glCodeMap.get(`program:${item.details?.programId}`) ?? undefined;
        else if (item.type === "pass")
          glCodeId = glCodeMap.get(`pass:${item.details?.passId || item.referenceId}`) ?? undefined;
        else if (item.type === "competition")
          glCodeId =
            glCodeMap.get(`competition:${item.details?.competitionId || item.referenceId}`) ??
            undefined;
        else if (item.type === "membership")
          glCodeId =
            glCodeMap.get(`membership:${item.details?.membershipInstanceId || item.referenceId}`) ??
            undefined;
        else if (item.type === "item")
          glCodeId = glCodeMap.get(`item:${item.referenceId}`) ?? undefined;

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
          programId: item.type === "program" ? item.details?.programId || undefined : undefined,
          membershipInstanceId:
            item.type === "membership"
              ? item.details?.membershipInstanceId || item.referenceId
              : undefined,
          passId: item.type === "pass" ? item.details?.passId || item.referenceId : undefined,
          competitionId:
            item.type === "competition"
              ? item.details?.competitionId || item.referenceId
              : undefined,
          productId: item.type === "item" ? item.referenceId : undefined,
          productVariantId: item.type === "item" ? item.details?.variantId || undefined : undefined,
          athleteId: item.athleteId || item.details?.athleteId || undefined,
          glCodeId,
        };
      }),
    });

    // 7b. Add discount line item (usage already claimed atomically during validation)
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
    }

    // 7c. Create bulk discount line item
    if (bulkDiscountLineAmount > 0) {
      await db.lineItem.create({
        data: {
          invoiceId: invoice.id,
          description: "Bulk Registration Discount",
          quantity: 1,
          unitPrice: -bulkDiscountLineAmount,
          total: -bulkDiscountLineAmount,
        },
      });
    }

    // 7d. Create Order record if cart contains store products
    const productItems = items.filter((i: CartItem) => i.type === "item");
    if (productItems.length > 0) {
      await db.order.create({
        data: {
          invoiceId: invoice.id,
          organizationId,
          source: "ONLINE",
          fulfillmentStatus: "PENDING",
          customerName: `${resolvedContact.firstName} ${resolvedContact.lastName}`.trim() || null,
          customerEmail: resolvedContact.email || null,
          customerPhone: resolvedContact.phone || null,
          shippingStreet: shippingAddress?.street || null,
          shippingCity: shippingAddress?.city || null,
          shippingState: shippingAddress?.stateProvince || null,
          shippingPostalCode: shippingAddress?.postalCode || null,
          shippingCountry: shippingAddress?.country || null,
        },
      });
    }

    // 8. Handle payment — skip Adyen entirely for $0 orders
    if (total === 0) {
      // Invoice and line items are already created above (shared path).
      // Finalize will complete the order when the user confirms.
      return NextResponse.json({
        freeCheckout: true,
        invoiceId: invoice.id,
      });
    }

    // Build Adyen line items with per-item tax breakdown (all amounts in minor units / cents)
    const customerTaxRate = taxPaidBy === "CUSTOMER" ? taxRate : 0;
    const taxPct = Math.round(customerTaxRate * 10000); // Adyen wants percentage × 100 (e.g. 6.25% = 625)
    const totalMinor = Math.round(total * 100);
    const customerTaxMinor = taxPaidBy === "CUSTOMER" ? Math.round(tax * 100) : 0;
    const subtotalMinor = totalMinor - customerTaxMinor;

    const adyenLineItems: AdyenLineItem[] = items.map((item: CartItem, index: number) => {
      const itemTotal = serverPrices.has(index)
        ? serverPrices.get(index)!
        : Number(item.price) * item.quantity;
      const itemShare = subtotal > 0 ? itemTotal / subtotal : 0;
      const itemDiscount = Math.round(discountLineAmount * itemShare * 100) / 100;
      const itemAfterDiscount = Math.max(itemTotal - itemDiscount, 0);
      const excl = Math.round(itemAfterDiscount * 100);
      const itemTaxMinor = Math.round(itemAfterDiscount * customerTaxRate * 100);

      const product = item.type === "item" ? productMap.get(item.referenceId) : undefined;

      return {
        id: item.referenceId,
        description: item.name,
        quantity: item.quantity,
        amountExcludingTax: excl,
        taxAmount: itemTaxMinor,
        amountIncludingTax: excl + itemTaxMinor,
        taxPercentage: taxPct,
        ...(product?.sku && { sku: product.sku }),
        ...(product?.imageUrl && { imageUrl: product.imageUrl }),
      };
    });

    // Correct rounding residuals so line item sums exactly equal the session amount
    if (adyenLineItems.length > 0) {
      const sumExcl = adyenLineItems.reduce((s, li) => s + li.amountExcludingTax, 0);
      const sumTax = adyenLineItems.reduce((s, li) => s + li.taxAmount, 0);
      const last = adyenLineItems[adyenLineItems.length - 1];
      last.amountExcludingTax += subtotalMinor - sumExcl;
      last.taxAmount += customerTaxMinor - sumTax;
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

    // Force tokenization when cart contains any recurring items
    const hasRecurringProgram = programItemsForPrice.some(({ item }) => {
      const programId = item.details?.programId || item.referenceId;
      const prog = programPriceMap.get(programId);
      return prog && prog.billingInterval !== "ONE_TIME" && prog.recurringPrice;
    });
    const hasRecurringPass = passInvoiceItems.some(
      (item: CartItem) =>
        item.details?.billingInterval &&
        item.details.billingInterval !== "ONE_TIME" &&
        item.details.billingInterval !== "SESSION"
    );
    const hasRecurringMembership = membershipInvoiceItems.some(
      (item: CartItem) =>
        item.details?.billingInterval &&
        item.details.billingInterval !== "ONE_TIME" &&
        item.details.billingInterval !== "SESSION"
    );
    const hasRecurringItems = hasRecurringProgram || hasRecurringPass || hasRecurringMembership;

    const billingFirstName = billingAddressInput?.firstName || resolvedContact.firstName;
    const billingLastName = billingAddressInput?.lastName || resolvedContact.lastName;
    const shopperName = `${billingFirstName} ${billingLastName}`.trim() || undefined;

    const adyenBillingAddress = resolvedAddress.street
      ? {
          street: resolvedAddress.street,
          city: resolvedAddress.city,
          stateOrProvince: resolvedAddress.stateProvince || "N/A",
          postalCode: resolvedAddress.postalCode,
          country: billingAddressInput?.country || "US",
        }
      : undefined;

    // Every payment must be routed to the org's Adyen store via its storeReference so
    // split-configured funds land in the right balance account. Missing either the
    // platform account or the storeReference means onboarding was never completed;
    // failing loudly is safer than booking the funds to the platform's liable account.
    const storeReference = config.organization.adyenPlatformAccount?.storeReference;
    if (!storeReference) {
      Sentry.captureMessage("Adyen storeReference missing at checkout", {
        level: "fatal",
        extra: {
          organizationId: config.organization.id,
          invoiceId: invoice.id,
          hasPlatformAccount: !!config.organization.adyenPlatformAccount,
        },
      });
      return NextResponse.json(
        { error: "Payment routing is not configured. Please contact support." },
        { status: 500 }
      );
    }

    const session = await createPaymentSession(
      total,
      "USD",
      invoice.id,
      returnUrl,
      resolvedContact.email,
      adyenLineItems,
      hasAuthSession
        ? {
            shopperReference: `user-${authUserId}`,
            storePaymentMethodMode: hasRecurringItems ? "enabled" : "askForConsent",
            recurringProcessingModel: hasRecurringItems ? "Subscription" : "CardOnFile",
          }
        : undefined,
      shopperName,
      adyenBillingAddress,
      storeReference
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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
