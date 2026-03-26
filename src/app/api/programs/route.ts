import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";
import { checkMemberCertifications, type CertCheckFailure } from "@/lib/services/certification-check";
import { z } from "zod";
import { generateInstanceDates, calculateEndTime } from "@/lib/program-instance-utils";
import { getEnabledHolidayDates, filterOutHolidayDates } from "@/lib/holiday-utils";

class CertificationError extends Error {
  memberId: string;
  missing: CertCheckFailure[];
  constructor(memberId: string, missing: CertCheckFailure[]) {
    super("Missing required certifications");
    this.memberId = memberId;
    this.missing = missing;
  }
}

const createProgramSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  pricingModel: z.enum(["FLAT_RATE", "PER_SESSION"]).default("FLAT_RATE"),
  basePrice: z.number().min(0).optional().nullable(),
  perSessionPrice: z.number().min(0).optional().nullable(),
  billingInterval: z.enum(["ONE_TIME", "MONTHLY", "YEARLY", "SESSION"]).default("ONE_TIME"),
  recurringPrice: z.number().min(0).optional().nullable(),
  registrationType: z.enum(["ALL_INSTANCES", "PER_INSTANCE"]).default("ALL_INSTANCES"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  startTime: z.string().optional().nullable(), // e.g., "09:00"
  duration: z.number().int().min(1).optional().nullable(), // minutes
  rrule: z.string().optional().nullable(), // RFC 5545 RRULE string
  facilityId: z.string().optional().nullable(),
  capacity: z.number().int().min(1).optional().nullable(),
  showCoachOnSite: z.boolean().default(true),
  imageUrl: z.string().url().optional().nullable(),
  // Age restrictions
  minAge: z.number().int().min(0).max(100).optional().nullable(),
  maxAge: z.number().int().min(0).max(100).optional().nullable(),
  // Space capacity
  hasSpaceRestriction: z.boolean().default(false),
  spaceCapacityMode: z.enum(["MINIMUM", "SUM"]).default("MINIMUM"),
  // Restriction flags
  hasGenderRestriction: z.boolean().default(false),
  hasLevelRestriction: z.boolean().default(false),
  hasCapacityRestriction: z.boolean().default(false),
  hasAgeRestriction: z.boolean().default(false),
  hasMembershipRestriction: z.boolean().default(false),
  hasPassRestriction: z.boolean().default(false),
  hasWaiverRestriction: z.boolean().default(false),
  hasMedicalRequirement: z.boolean().default(false),
  hasFileRequirement: z.boolean().default(false),
  fileRequirementConfig: z.any().optional().nullable(),
  // Gender restriction values
  allowedGenders: z.array(z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"])).default([]),
  // Waitlist
  waitlistEnabled: z.boolean().default(false),
  waitlistAutoPromote: z.boolean().default(false),
  waitlistCapacity: z.number().int().min(1).optional().nullable(),
  // Related data for creation
  levelRequirementIds: z.array(z.string()).optional(),
  membershipRequirementIds: z.array(z.string()).optional(),
  passRequirementIds: z.array(z.string()).optional(),
  waiverRequirementIds: z.array(z.string()).optional(),
  spaceIds: z.array(z.string()).optional(),
  staffAssignments: z.array(z.object({
    memberId: z.string(),
    role: z.enum(["LEAD_COACH", "ASSISTANT_COACH", "SUBSTITUTE", "VOLUNTEER"]).default("ASSISTANT_COACH"),
    isPrimary: z.boolean().default(false),
  })).optional(),
  glCodeId: z.string().optional().nullable(),
  seasonId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  // Registration window
  registrationStartDate: z.string().optional().nullable(),
  registrationStartTime: z.string().optional().nullable(),
  registrationEndDate: z.string().optional().nullable(),
  registrationEndTime: z.string().optional().nullable(),
  registrationOpen: z.boolean().default(true),
  earlyAccessCode: z.string().optional().nullable(),
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
    const seasonId = searchParams.get("seasonId");
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
      ...(seasonId && { seasonId }),
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
              instances: true,
            },
          },
          facility: {
            select: { id: true, name: true, city: true, stateProvince: true },
          },
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
              member: {
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
          waiverRequirements: {
            include: {
              waiver: {
                select: { id: true, title: true, status: true },
              },
            },
          },
          spaces: {
            include: {
              space: {
                select: { id: true, name: true, capacity: true, status: true },
              },
            },
          },
          season: {
            select: { id: true, name: true, color: true, startDate: true, endDate: true },
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

    const scopedDb = getScopedDb(session.user.organizationId);

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
      const currentCount = await scopedDb.program.count();
      
      if (currentCount >= maxPrograms) {
        return NextResponse.json({ 
          error: `Programs limit reached. Your plan allows a maximum of ${maxPrograms} program${maxPrograms === 1 ? '' : 's'}. Please upgrade your plan to create more programs.` 
        }, { status: 400 });
      }
    }

    const body = await request.json();
    const validatedData = createProgramSchema.parse(body);

    if (validatedData.facilityId) {
      const facility = await scopedDb.facility.findUnique({ where: { id: validatedData.facilityId } });
      if (!facility) return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }
    if (validatedData.glCodeId) {
      const glCode = await scopedDb.gLCode.findUnique({ where: { id: validatedData.glCodeId } });
      if (!glCode) return NextResponse.json({ error: "GL code not found" }, { status: 404 });
    }
    if (validatedData.levelRequirementIds?.length) {
      const valid = await scopedDb.level.findMany({ where: { id: { in: validatedData.levelRequirementIds } }, select: { id: true } });
      if (valid.length !== validatedData.levelRequirementIds.length) return NextResponse.json({ error: "One or more levels not found" }, { status: 404 });
    }
    if (validatedData.waiverRequirementIds?.length) {
      const valid = await scopedDb.waiver.findMany({ where: { id: { in: validatedData.waiverRequirementIds } }, select: { id: true } });
      if (valid.length !== validatedData.waiverRequirementIds.length) return NextResponse.json({ error: "One or more waivers not found" }, { status: 404 });
    }
    if (validatedData.membershipRequirementIds?.length) {
      const valid = await db.membershipInstance.findMany({
        where: { id: { in: validatedData.membershipRequirementIds }, group: { organizationId: session.user.organizationId } },
        select: { id: true },
      });
      if (valid.length !== validatedData.membershipRequirementIds.length) return NextResponse.json({ error: "One or more membership instances not found" }, { status: 404 });
    }
    if (validatedData.passRequirementIds?.length) {
      const valid = await scopedDb.pass.findMany({ where: { id: { in: validatedData.passRequirementIds } }, select: { id: true } });
      if (valid.length !== validatedData.passRequirementIds.length) return NextResponse.json({ error: "One or more passes not found" }, { status: 404 });
    }
    if (validatedData.spaceIds?.length) {
      const valid = await db.space.findMany({
        where: { id: { in: validatedData.spaceIds }, facility: { organizationId: session.user.organizationId } },
        select: { id: true },
      });
      if (valid.length !== validatedData.spaceIds.length) return NextResponse.json({ error: "One or more spaces not found" }, { status: 404 });
    }
    if (validatedData.categoryId) {
      const cat = await scopedDb.category.findUnique({ where: { id: validatedData.categoryId }, select: { id: true } });
      if (!cat) return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Pre-compute holiday dates outside the transaction so the read uses `db` properly
    let holidayDates = new Set<string>();
    if (validatedData.startDate && validatedData.startTime && validatedData.duration) {
      const sd = parseDateOnly(validatedData.startDate)!;
      const ed = validatedData.endDate ? parseDateOnly(validatedData.endDate)! : sd;
      holidayDates = await getEnabledHolidayDates(session.user.organizationId!, sd, ed);
    }

    const program = await db.$transaction(async (tx) => {
      const newProgram = await tx.program.create({
        data: {
          name: validatedData.name,
          description: validatedData.description,
          color: validatedData.color,
          status: validatedData.status,
          pricingModel: validatedData.pricingModel,
          basePrice: validatedData.basePrice,
          perSessionPrice: validatedData.perSessionPrice,
          billingInterval: validatedData.billingInterval,
          recurringPrice: validatedData.recurringPrice,
          registrationType: validatedData.registrationType,
          startDate: validatedData.startDate ? parseDateOnly(validatedData.startDate) : null,
          endDate: validatedData.endDate ? parseDateOnly(validatedData.endDate) : null,
          startTime: validatedData.startTime,
          duration: validatedData.duration,
          rrule: validatedData.rrule,
          facilityId: validatedData.facilityId,
          capacity: validatedData.capacity,
          showCoachOnSite: validatedData.showCoachOnSite,
          imageUrl: validatedData.imageUrl,
          minAge: validatedData.minAge,
          maxAge: validatedData.maxAge,
          hasSpaceRestriction: validatedData.hasSpaceRestriction,
          spaceCapacityMode: validatedData.spaceCapacityMode,
          hasLevelRestriction: validatedData.hasLevelRestriction,
          hasCapacityRestriction: validatedData.hasCapacityRestriction,
          hasAgeRestriction: validatedData.hasAgeRestriction,
          hasMembershipRestriction: validatedData.hasMembershipRestriction,
          hasPassRestriction: validatedData.hasPassRestriction,
          hasWaiverRestriction: validatedData.hasWaiverRestriction,
          hasMedicalRequirement: validatedData.hasMedicalRequirement,
          hasFileRequirement: validatedData.hasFileRequirement,
          fileRequirementConfig: validatedData.fileRequirementConfig ?? undefined,
          waitlistEnabled: validatedData.waitlistEnabled,
          waitlistAutoPromote: validatedData.waitlistAutoPromote,
          waitlistCapacity: validatedData.waitlistCapacity,
          glCodeId: validatedData.glCodeId ?? undefined,
          registrationStartDate: validatedData.registrationStartDate ? parseDateOnly(validatedData.registrationStartDate) : null,
          registrationStartTime: validatedData.registrationStartTime,
          registrationEndDate: validatedData.registrationEndDate ? parseDateOnly(validatedData.registrationEndDate) : null,
          registrationEndTime: validatedData.registrationEndTime,
          registrationOpen: validatedData.registrationOpen,
          earlyAccessCode: validatedData.earlyAccessCode,
          seasonId: validatedData.seasonId ?? undefined,
          categoryId: validatedData.categoryId ?? undefined,
          organizationId: session.user.organizationId,
          ...(validatedData.membershipRequirementIds?.length && {
            requiredMemberships: {
              connect: validatedData.membershipRequirementIds.map(id => ({ id })),
            },
          }),
          ...(validatedData.passRequirementIds?.length && {
            requiredPasses: {
              connect: validatedData.passRequirementIds.map(id => ({ id })),
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

      // Create waiver requirements if provided
      if (validatedData.waiverRequirementIds?.length) {
        await tx.programWaiverRequirement.createMany({
          data: validatedData.waiverRequirementIds.map(waiverId => ({
            programId: newProgram.id,
            waiverId,
          })),
        });
      }

      // Create staff assignments if provided (with certification enforcement)
      if (validatedData.staffAssignments?.length) {
        for (const sa of validatedData.staffAssignments) {
          const certResult = await checkMemberCertifications(
            session.user.organizationId!,
            sa.memberId,
            "programs"
          );
          if (!certResult.valid) {
            throw new CertificationError(sa.memberId, certResult.missing);
          }
        }

        await tx.programStaff.createMany({
          data: validatedData.staffAssignments.map(sa => ({
            programId: newProgram.id,
            memberId: sa.memberId,
            role: sa.role,
            isPrimary: sa.isPrimary,
          })),
        });
      }

      // Create space assignments if provided
      if (validatedData.spaceIds?.length) {
        await tx.programSpace.createMany({
          data: validatedData.spaceIds.map(spaceId => ({
            programId: newProgram.id,
            spaceId,
          })),
        });
      }

      // Generate program instances based on schedule
      if (validatedData.startDate && validatedData.startTime && validatedData.duration) {
        const startDate = parseDateOnly(validatedData.startDate)!;
        const endDate = validatedData.endDate ? parseDateOnly(validatedData.endDate)! : startDate;
        const endTime = calculateEndTime(validatedData.startTime, validatedData.duration);
        
        const allDates = validatedData.rrule
          ? generateInstanceDates(startDate, endDate, validatedData.rrule)
          : [startDate];

        const instanceDates = filterOutHolidayDates(allDates, holidayDates);
        
        // Create program instances
        if (instanceDates.length > 0) {
          await tx.programInstance.createMany({
            data: instanceDates.map(date => ({
              programId: newProgram.id,
              date,
              startTime: validatedData.startTime!,
              endTime,
              facilityId: validatedData.facilityId,
              capacity: validatedData.capacity,
              organizationId: session.user.organizationId!,
            })),
          });

          // Assign spaces to instances (inherit from program defaults)
          if (validatedData.spaceIds?.length) {
            const createdInstances = await tx.programInstance.findMany({
              where: { programId: newProgram.id },
              select: { id: true },
            });

            const instanceSpaceData = createdInstances.flatMap(inst =>
              validatedData.spaceIds!.map(spaceId => ({
                programInstanceId: inst.id,
                spaceId,
              }))
            );

            if (instanceSpaceData.length > 0) {
              await tx.programInstanceSpace.createMany({
                data: instanceSpaceData,
              });
            }
          }
        }
      }

      // Fetch the complete program with all relations
      return tx.program.findUnique({
        where: { id: newProgram.id },
        include: {
          facility: {
            select: { id: true, name: true, city: true, stateProvince: true },
          },
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
              member: {
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
          waiverRequirements: {
            include: {
              waiver: {
                select: { id: true, title: true, status: true },
              },
            },
          },
          spaces: {
            include: {
              space: {
                select: { id: true, name: true, capacity: true, status: true },
              },
            },
          },
          _count: {
            select: {
              enrollments: true,
              events: true,
              lessonPlans: true,
              instances: true,
            },
          },
        },
      });
    });

    return NextResponse.json(program);
  } catch (error) {
    if (error instanceof CertificationError) {
      return NextResponse.json(
        { error: "Missing required certifications", certifications: error.missing },
        { status: 422 }
      );
    }
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
