import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb, db } from "@/lib/db";
import { z } from "zod";

const genderEnum = z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]);

const createMembershipGroupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  programTypes: z.array(z.string()).default([]),

  // Recurrence
  isRecurring: z.boolean().default(false),
  allowAutoRenew: z.boolean().default(false),

  // Default Pricing
  defaultPrice: z.number().min(0).optional(),
  defaultBillingInterval: z.enum(["ONE_TIME", "MONTHLY", "YEARLY", "SESSION"]).default("ONE_TIME"),

  // Instance Generation
  autoGenerateInstances: z.boolean().default(false),
  generationLeadDays: z.number().int().min(1).default(30),

  // Purchase Window
  purchaseWindowDays: z.number().int().min(0).nullable().optional(),

  // Capacity
  capacity: z.number().int().min(0).nullable().optional(),

  // Restriction Flags
  hasGenderRestriction: z.boolean().default(false),
  hasAgeRestriction: z.boolean().default(false),
  hasLevelRestriction: z.boolean().default(false),
  hasCapacityRestriction: z.boolean().default(false),
  hasWaiverRestriction: z.boolean().default(false),
  hasMedicalRequirement: z.boolean().default(false),

  // Restriction Values
  allowedGenders: z.array(genderEnum).default([]),
  minAge: z.number().int().min(0).max(100).nullable().optional(),
  maxAge: z.number().int().min(0).max(100).nullable().optional(),
});

// GET /api/memberships - List Membership Groups
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const includeInstances = searchParams.get("include") === "instances";
    const includeRestrictions = searchParams.get("include")?.includes("restrictions");
    const scopedDb = getScopedDb(session.user.organizationId);

    const [groups, total] = await Promise.all([
      scopedDb.membershipGroup.findMany({
        include: {
          _count: {
            select: {
              instances: true,
            },
          },
          instances: includeInstances ? {
             orderBy: { startDate: 'desc' },
             include: {
               _count: { select: { athleteMemberships: true } },
             },
          } : undefined,
          levelRequirements: includeRestrictions ? {
            include: { level: { select: { id: true, name: true, color: true } } },
          } : undefined,
          waiverRequirements: includeRestrictions ? {
            include: { waiver: { select: { id: true, title: true, status: true } } },
          } : undefined,
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      scopedDb.membershipGroup.count(),
    ]);

    return NextResponse.json({
      data: groups,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching membership groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch membership groups" },
      { status: 500 }
    );
  }
}

// POST /api/memberships - Create Membership Group
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let permissions = session.user.permissions || [];
    
    // Fallback: If no permissions in session, verify against DB
    if (permissions.length === 0) {
       const user = await db.user.findUnique({ 
           where: { id: session.user.id },
           include: { permissions: true }
       }) ?? (session.user.email ? await db.user.findUnique({
           where: { email: session.user.email },
           include: { permissions: true }
       }) : null);

       if (user) {
           permissions = user.permissions.map(p => p.permission);
           if (user.isSuperAdmin && !permissions.includes("*")) {
               permissions.push("*");
           }
       }
    }

    if (
      !permissions.includes("*") &&
      !permissions.includes("training.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createMembershipGroupSchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    // Check membership types limit
    const organization = await db.organization.findUnique({
      where: { id: session.user.organizationId! },
      include: {
        subscription: {
          include: { plan: true }
        }
      }
    });

    if (organization?.subscription?.plan?.maxMembershipTypes) {
      const maxTypes = organization.subscription.plan.maxMembershipTypes;
      const currentCount = await scopedDb.membershipGroup.count();
      
      if (currentCount >= maxTypes) {
        return NextResponse.json({ 
          error: `Membership types limit reached. Your plan allows a maximum of ${maxTypes} membership type${maxTypes === 1 ? '' : 's'}. Please upgrade your plan to create more membership types.` 
        }, { status: 400 });
      }
    }

    // Use transaction to create group + auto-instance for non-recurring groups
    const result = await db.$transaction(async (tx) => {
      const group = await tx.membershipGroup.create({
        data: {
          organizationId: session.user.organizationId!,
          name: validatedData.name,
          description: validatedData.description,
          programTypes: validatedData.programTypes,
          isRecurring: validatedData.isRecurring,
          allowAutoRenew: validatedData.allowAutoRenew,
          defaultPrice: validatedData.defaultPrice,
          defaultBillingInterval: validatedData.defaultBillingInterval,
          autoGenerateInstances: validatedData.autoGenerateInstances,
          generationLeadDays: validatedData.generationLeadDays,
          purchaseWindowDays: validatedData.purchaseWindowDays ?? null,
          capacity: validatedData.capacity ?? null,
          hasGenderRestriction: validatedData.hasGenderRestriction,
          hasAgeRestriction: validatedData.hasAgeRestriction,
          hasLevelRestriction: validatedData.hasLevelRestriction,
          hasCapacityRestriction: validatedData.hasCapacityRestriction,
          hasWaiverRestriction: validatedData.hasWaiverRestriction,
          hasMedicalRequirement: validatedData.hasMedicalRequirement,
          allowedGenders: validatedData.allowedGenders,
          minAge: validatedData.minAge ?? null,
          maxAge: validatedData.maxAge ?? null,
        },
      });

      // For non-recurring groups, auto-create a single default instance
      if (!validatedData.isRecurring && validatedData.defaultPrice != null) {
        const farFuture = new Date("2099-12-31T23:59:59.999Z");
        await tx.membershipInstance.create({
          data: {
            membershipGroupId: group.id,
            name: group.name,
            price: validatedData.defaultPrice,
            billingInterval: "ONE_TIME",
            startDate: new Date(),
            endDate: farFuture,
            status: "ACTIVE",
            isAutoGenerated: true,
          },
        });
      }

      return tx.membershipGroup.findUnique({
        where: { id: group.id },
        include: {
          instances: true,
          _count: { select: { instances: true } },
        },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating membership group:", error);
    return NextResponse.json(
      { error: `Failed to create membership group: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
