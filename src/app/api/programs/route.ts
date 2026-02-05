import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { z } from "zod";

const createProgramSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  level: z.string().optional().default(""), // Legacy field - now optional
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  // Program type and pricing
  programType: z.enum(["SINGLE_INSTANCE", "SUBSCRIPTION", "DROP_IN"]).default("SUBSCRIPTION"),
  pricingModel: z.enum(["FLAT_RATE", "PER_SESSION"]).default("FLAT_RATE"),
  basePrice: z.number().min(0).optional().nullable(),
  perSessionPrice: z.number().min(0).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  schedulePattern: z.any().optional().nullable(),
  capacity: z.number().int().min(1).optional().nullable(),
  levelId: z.string().optional().nullable(),
  showLevelOnSite: z.boolean().default(true),
  showCoachOnSite: z.boolean().default(true),
  // Age restrictions
  minAge: z.number().int().min(0).max(100).optional().nullable(),
  maxAge: z.number().int().min(0).max(100).optional().nullable(),
  // Restriction flags
  hasLevelRestriction: z.boolean().default(false),
  hasCapacityRestriction: z.boolean().default(false),
  hasAgeRestriction: z.boolean().default(false),
  hasMembershipRestriction: z.boolean().default(false),
  // Related data for creation
  levelRequirementIds: z.array(z.string()).optional(),
  membershipRequirementIds: z.array(z.string()).optional(),
  staffAssignments: z.array(z.object({
    staffProfileId: z.string(),
    role: z.enum(["LEAD_COACH", "ASSISTANT_COACH", "SUBSTITUTE", "VOLUNTEER"]).default("ASSISTANT_COACH"),
    isPrimary: z.boolean().default(false),
  })).optional(),
});

// GET /api/programs
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const scopedDb = getScopedDb(session.user.organizationId);

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(status && { status: status as "ACTIVE" | "INACTIVE" | "ARCHIVED" }),
    };

    const [programs, total] = await Promise.all([
      scopedDb.program.findMany({
        where,
        include: {
          _count: {
            select: {
              enrollments: true,
              events: true,
              lessonPlans: true,
            },
          },
          membershipTiers: true,
          programLevel: true,
          bulkDiscounts: {
            orderBy: [{ type: "asc" }, { minQuantity: "asc" }],
          },
          levelRequirements: {
            include: {
              level: {
                select: { id: true, name: true, color: true },
              },
            },
          },
          staffAssignments: {
            include: {
              staffProfile: {
                include: {
                  user: {
                    select: { id: true, name: true, avatar: true },
                  },
                },
              },
            },
          },
          requiredMemberships: {
            include: {
              group: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      scopedDb.program.count({ where }),
    ]);

    return NextResponse.json({
      data: programs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching programs:", error);
    return NextResponse.json(
      { error: "Failed to fetch programs" },
      { status: 500 }
    );
  }
}

// POST /api/programs
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check programs limit
    const organization = await db.organization.findUnique({
      where: { id: session.user.organizationId! },
      include: {
        subscription: {
          include: { plan: true }
        }
      }
    });

    if (organization?.subscription?.plan?.maxPrograms) {
      const maxPrograms = organization.subscription.plan.maxPrograms;
      const scopedDb = getScopedDb(session.user.organizationId);
      const currentCount = await scopedDb.program.count();
      
      if (currentCount >= maxPrograms) {
        return NextResponse.json({ 
          error: `Programs limit reached. Your plan allows a maximum of ${maxPrograms} program${maxPrograms === 1 ? '' : 's'}. Please upgrade your plan to create more programs.` 
        }, { status: 400 });
      }
    }

    const body = await request.json();
    const validatedData = createProgramSchema.parse(body);

    // Use db directly with manual organizationId for transactional operations
    // getScopedDb's tenant isolation doesn't work well within transactions
    // for records that were just created in the same transaction
    const program = await db.$transaction(async (tx) => {
      // Create the program with membership connections included
      const newProgram = await tx.program.create({
        data: {
          name: validatedData.name,
          description: validatedData.description,
          level: validatedData.level || "",
          status: validatedData.status,
          programType: validatedData.programType,
          pricingModel: validatedData.pricingModel,
          basePrice: validatedData.basePrice,
          perSessionPrice: validatedData.perSessionPrice,
          startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
          endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
          schedulePattern: validatedData.schedulePattern,
          capacity: validatedData.capacity,
          levelId: validatedData.levelId,
          showLevelOnSite: validatedData.showLevelOnSite,
          showCoachOnSite: validatedData.showCoachOnSite,
          minAge: validatedData.minAge,
          maxAge: validatedData.maxAge,
          hasLevelRestriction: validatedData.hasLevelRestriction,
          hasCapacityRestriction: validatedData.hasCapacityRestriction,
          hasAgeRestriction: validatedData.hasAgeRestriction,
          hasMembershipRestriction: validatedData.hasMembershipRestriction,
          organizationId: session.user.organizationId,
          // Connect membership requirements in initial create
          ...(validatedData.membershipRequirementIds?.length && {
            requiredMemberships: {
              connect: validatedData.membershipRequirementIds.map(id => ({ id })),
            },
          }),
        },
      });

      // Create level requirements if provided
      if (validatedData.levelRequirementIds?.length) {
        await tx.programLevelRequirement.createMany({
          data: validatedData.levelRequirementIds.map(levelId => ({
            programId: newProgram.id,
            levelId,
          })),
        });
      }

      // Create staff assignments if provided
      if (validatedData.staffAssignments?.length) {
        await tx.programStaff.createMany({
          data: validatedData.staffAssignments.map(sa => ({
            programId: newProgram.id,
            staffProfileId: sa.staffProfileId,
            role: sa.role,
            isPrimary: sa.isPrimary,
          })),
        });
      }

      // Fetch the complete program with all relations
      return tx.program.findUnique({
        where: { id: newProgram.id },
        include: {
          membershipTiers: true,
          programLevel: true,
          bulkDiscounts: true,
          levelRequirements: {
            include: {
              level: {
                select: { id: true, name: true, color: true },
              },
            },
          },
          staffAssignments: {
            include: {
              staffProfile: {
                include: {
                  user: {
                    select: { id: true, name: true, avatar: true },
                  },
                },
              },
            },
          },
          requiredMemberships: {
            include: {
              group: {
                select: { id: true, name: true },
              },
            },
          },
          _count: {
            select: {
              enrollments: true,
              events: true,
              lessonPlans: true,
            },
          },
        },
      });
    });

    return NextResponse.json(program);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating program:", error);
    return NextResponse.json(
      { error: "Failed to create program" },
      { status: 500 }
    );
  }
}
