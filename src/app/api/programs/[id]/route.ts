import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateProgramSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  level: z.string().optional(), // Legacy field
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  // Program type and pricing
  programType: z.enum(["SINGLE_INSTANCE", "SUBSCRIPTION", "DROP_IN"]).optional(),
  pricingModel: z.enum(["FLAT_RATE", "PER_SESSION"]).optional(),
  basePrice: z.number().min(0).optional().nullable(),
  perSessionPrice: z.number().min(0).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  schedulePattern: z.any().optional().nullable(),
  capacity: z.number().int().min(1).optional().nullable(),
  levelId: z.string().optional().nullable(),
  showLevelOnSite: z.boolean().optional(),
  showCoachOnSite: z.boolean().optional(),
  // Age restrictions
  minAge: z.number().int().min(0).max(100).optional().nullable(),
  maxAge: z.number().int().min(0).max(100).optional().nullable(),
  // Restriction flags
  hasLevelRestriction: z.boolean().optional(),
  hasCapacityRestriction: z.boolean().optional(),
  hasAgeRestriction: z.boolean().optional(),
  hasMembershipRestriction: z.boolean().optional(),
  // Related data for updates
  levelRequirementIds: z.array(z.string()).optional(),
  membershipRequirementIds: z.array(z.string()).optional(),
  staffAssignments: z.array(z.object({
    staffProfileId: z.string(),
    role: z.enum(["LEAD_COACH", "ASSISTANT_COACH", "SUBSTITUTE", "VOLUNTEER"]).default("ASSISTANT_COACH"),
    isPrimary: z.boolean().default(false),
  })).optional(),
});

// GET /api/programs/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const program = await db.program.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
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
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatar: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { isPrimary: "desc" },
            { role: "asc" },
          ],
        },
        requiredMemberships: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            athlete: {
              select: {
                id: true,
                name: true,
                level: true,
                avatar: true,
              },
            },
          },
        },
        events: {
          orderBy: { date: "desc" },
          take: 10,
        },
        lessonPlans: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        lineItems: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            invoice: {
              select: {
                id: true,
                reference: true,
                status: true,
                family: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
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

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    return NextResponse.json(program);
  } catch (error) {
    console.error("Error fetching program:", error);
    return NextResponse.json(
      { error: "Failed to fetch program" },
      { status: 500 }
    );
  }
}

// PATCH /api/programs/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateProgramSchema.parse(body);

    const existing = await db.program.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    // Use a transaction to update the program and related data
    const program = await db.$transaction(async (tx) => {
      // Prepare update data with proper type handling
      const updateData: Record<string, unknown> = {};
      
      if (validatedData.name !== undefined) updateData.name = validatedData.name;
      if (validatedData.description !== undefined) updateData.description = validatedData.description;
      if (validatedData.level !== undefined) updateData.level = validatedData.level;
      if (validatedData.status !== undefined) updateData.status = validatedData.status;
      if (validatedData.programType !== undefined) updateData.programType = validatedData.programType;
      if (validatedData.pricingModel !== undefined) updateData.pricingModel = validatedData.pricingModel;
      if (validatedData.basePrice !== undefined) updateData.basePrice = validatedData.basePrice;
      if (validatedData.perSessionPrice !== undefined) updateData.perSessionPrice = validatedData.perSessionPrice;
      if (validatedData.startDate !== undefined) updateData.startDate = validatedData.startDate ? new Date(validatedData.startDate) : null;
      if (validatedData.endDate !== undefined) updateData.endDate = validatedData.endDate ? new Date(validatedData.endDate) : null;
      if (validatedData.schedulePattern !== undefined) updateData.schedulePattern = validatedData.schedulePattern;
      if (validatedData.capacity !== undefined) updateData.capacity = validatedData.capacity;
      if (validatedData.levelId !== undefined) updateData.levelId = validatedData.levelId;
      if (validatedData.showLevelOnSite !== undefined) updateData.showLevelOnSite = validatedData.showLevelOnSite;
      if (validatedData.showCoachOnSite !== undefined) updateData.showCoachOnSite = validatedData.showCoachOnSite;
      // New fields
      if (validatedData.minAge !== undefined) updateData.minAge = validatedData.minAge;
      if (validatedData.maxAge !== undefined) updateData.maxAge = validatedData.maxAge;
      if (validatedData.hasLevelRestriction !== undefined) updateData.hasLevelRestriction = validatedData.hasLevelRestriction;
      if (validatedData.hasCapacityRestriction !== undefined) updateData.hasCapacityRestriction = validatedData.hasCapacityRestriction;
      if (validatedData.hasAgeRestriction !== undefined) updateData.hasAgeRestriction = validatedData.hasAgeRestriction;
      if (validatedData.hasMembershipRestriction !== undefined) updateData.hasMembershipRestriction = validatedData.hasMembershipRestriction;

      // Update the program
      await tx.program.update({
        where: { id },
        data: updateData,
      });

      // Update level requirements if provided
      if (validatedData.levelRequirementIds !== undefined) {
        // Delete existing requirements
        await tx.programLevelRequirement.deleteMany({
          where: { programId: id },
        });
        // Create new requirements
        if (validatedData.levelRequirementIds.length > 0) {
          await tx.programLevelRequirement.createMany({
            data: validatedData.levelRequirementIds.map(levelId => ({
              programId: id,
              levelId,
            })),
          });
        }
      }

      // Update membership requirements if provided
      if (validatedData.membershipRequirementIds !== undefined) {
        await tx.program.update({
          where: { id },
          data: {
            requiredMemberships: {
              set: validatedData.membershipRequirementIds.map(membId => ({ id: membId })),
            },
          },
        });
      }

      // Update staff assignments if provided
      if (validatedData.staffAssignments !== undefined) {
        // Delete existing assignments
        await tx.programStaff.deleteMany({
          where: { programId: id },
        });
        // Create new assignments
        if (validatedData.staffAssignments.length > 0) {
          await tx.programStaff.createMany({
            data: validatedData.staffAssignments.map(sa => ({
              programId: id,
              staffProfileId: sa.staffProfileId,
              role: sa.role,
              isPrimary: sa.isPrimary,
            })),
          });
        }
      }

      // Fetch and return the updated program with all relations
      return tx.program.findUnique({
        where: { id },
        include: {
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
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      avatar: true,
                    },
                  },
                },
              },
            },
          },
          requiredMemberships: {
            include: {
              group: {
                select: {
                  id: true,
                  name: true,
                },
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
    console.error("Error updating program:", error);
    return NextResponse.json(
      { error: "Failed to update program" },
      { status: 500 }
    );
  }
}

// DELETE /api/programs/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.program.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    // Check if there are active enrollments
    if (existing._count.enrollments > 0) {
      return NextResponse.json(
        { error: "Cannot delete program with active enrollments. Archive it instead." },
        { status: 400 }
      );
    }

    await db.program.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting program:", error);
    return NextResponse.json(
      { error: "Failed to delete program" },
      { status: 500 }
    );
  }
}
