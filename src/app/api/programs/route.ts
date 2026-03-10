import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";
import { checkMemberCertifications, type CertCheckFailure } from "@/lib/services/certification-check";
import { z } from "zod";
import { RRule } from "rrule";

class CertificationError extends Error {
  memberId: string;
  missing: CertCheckFailure[];
  constructor(memberId: string, missing: CertCheckFailure[]) {
    super("Missing required certifications");
    this.memberId = memberId;
    this.missing = missing;
  }
}
import { format, addMinutes, parse } from "date-fns";

const createProgramSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  pricingModel: z.enum(["FLAT_RATE", "PER_SESSION"]).default("FLAT_RATE"),
  basePrice: z.number().min(0).optional().nullable(),
  perSessionPrice: z.number().min(0).optional().nullable(),
  // New calendar scheduling fields
  recurrenceType: z.enum(["NON_RECURRING", "RECURRING"]).default("RECURRING"),
  registrationType: z.enum(["ALL_INSTANCES", "PER_INSTANCE"]).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  startTime: z.string().optional().nullable(), // e.g., "09:00"
  duration: z.number().int().min(1).optional().nullable(), // minutes
  rrule: z.string().optional().nullable(), // RFC 5545 RRULE string
  facilityId: z.string().optional().nullable(),
  capacity: z.number().int().min(1).optional().nullable(),
  showCoachOnSite: z.boolean().default(true),
  // Age restrictions
  minAge: z.number().int().min(0).max(100).optional().nullable(),
  maxAge: z.number().int().min(0).max(100).optional().nullable(),
  // Training zone capacity
  hasTrainingZoneRestriction: z.boolean().default(false),
  trainingZoneCapacityMode: z.enum(["MINIMUM", "SUM"]).default("MINIMUM"),
  // Restriction flags
  hasGenderRestriction: z.boolean().default(false),
  hasLevelRestriction: z.boolean().default(false),
  hasCapacityRestriction: z.boolean().default(false),
  hasAgeRestriction: z.boolean().default(false),
  hasMembershipRestriction: z.boolean().default(false),
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
  waiverRequirementIds: z.array(z.string()).optional(),
  trainingZoneIds: z.array(z.string()).optional(),
  staffAssignments: z.array(z.object({
    memberId: z.string(),
    role: z.enum(["LEAD_COACH", "ASSISTANT_COACH", "SUBSTITUTE", "VOLUNTEER"]).default("ASSISTANT_COACH"),
    isPrimary: z.boolean().default(false),
  })).optional(),
});

/**
 * Generate program instances from an RRULE and date range
 */
function generateInstanceDates(
  startDate: Date,
  endDate: Date,
  rruleString: string | null
): Date[] {
  if (!rruleString) {
    // For non-recurring programs, just return the start date
    return [startDate];
  }
  
  try {
    // Parse the RRULE string
    const rruleWithDtstart = `DTSTART:${format(startDate, "yyyyMMdd'T'HHmmss'Z'")}\nRRULE:${rruleString}`;
    const rule = RRule.fromString(rruleWithDtstart);
    
    // Get all occurrences between start and end date
    return rule.between(startDate, endDate, true);
  } catch (error) {
    console.error("Error parsing RRULE:", error);
    return [startDate];
  }
}

/**
 * Calculate end time from start time and duration
 */
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const startDate = new Date(2000, 0, 1, hours, minutes);
  const endDate = addMinutes(startDate, durationMinutes);
  return format(endDate, "HH:mm");
}

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
          trainingZones: {
            include: {
              trainingZone: {
                select: { id: true, name: true, type: true, capacity: true, status: true },
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
          color: validatedData.color,
          status: validatedData.status,
          pricingModel: validatedData.pricingModel,
          basePrice: validatedData.basePrice,
          perSessionPrice: validatedData.perSessionPrice,
          // New calendar scheduling fields
          recurrenceType: validatedData.recurrenceType,
          registrationType: validatedData.registrationType,
          startDate: validatedData.startDate ? parseDateOnly(validatedData.startDate) : null,
          endDate: validatedData.endDate ? parseDateOnly(validatedData.endDate) : null,
          startTime: validatedData.startTime,
          duration: validatedData.duration,
          rrule: validatedData.rrule,
          facilityId: validatedData.facilityId,
          capacity: validatedData.capacity,
          showCoachOnSite: validatedData.showCoachOnSite,
          minAge: validatedData.minAge,
          maxAge: validatedData.maxAge,
          hasTrainingZoneRestriction: validatedData.hasTrainingZoneRestriction,
          trainingZoneCapacityMode: validatedData.trainingZoneCapacityMode,
          hasLevelRestriction: validatedData.hasLevelRestriction,
          hasCapacityRestriction: validatedData.hasCapacityRestriction,
          hasAgeRestriction: validatedData.hasAgeRestriction,
          hasMembershipRestriction: validatedData.hasMembershipRestriction,
          hasWaiverRestriction: validatedData.hasWaiverRestriction,
          hasMedicalRequirement: validatedData.hasMedicalRequirement,
          hasFileRequirement: validatedData.hasFileRequirement,
          fileRequirementConfig: validatedData.fileRequirementConfig ?? undefined,
          waitlistEnabled: validatedData.waitlistEnabled,
          waitlistAutoPromote: validatedData.waitlistAutoPromote,
          waitlistCapacity: validatedData.waitlistCapacity,
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

      // Create training zone assignments if provided
      if (validatedData.trainingZoneIds?.length) {
        await tx.programTrainingZone.createMany({
          data: validatedData.trainingZoneIds.map(trainingZoneId => ({
            programId: newProgram.id,
            trainingZoneId,
          })),
        });
      }

      // Generate program instances based on schedule
      if (validatedData.startDate && validatedData.startTime && validatedData.duration) {
        const startDate = parseDateOnly(validatedData.startDate)!;
        const endDate = validatedData.endDate ? parseDateOnly(validatedData.endDate)! : startDate;
        const endTime = calculateEndTime(validatedData.startTime, validatedData.duration);
        
        // Generate dates based on recurrence type
        const instanceDates = validatedData.recurrenceType === "RECURRING" && validatedData.rrule
          ? generateInstanceDates(startDate, endDate, validatedData.rrule)
          : [startDate];
        
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

          // Assign training zones to instances (inherit from program defaults)
          if (validatedData.trainingZoneIds?.length) {
            const createdInstances = await tx.programInstance.findMany({
              where: { programId: newProgram.id },
              select: { id: true },
            });

            const instanceZoneData = createdInstances.flatMap(inst =>
              validatedData.trainingZoneIds!.map(trainingZoneId => ({
                programInstanceId: inst.id,
                trainingZoneId,
              }))
            );

            if (instanceZoneData.length > 0) {
              await tx.programInstanceTrainingZone.createMany({
                data: instanceZoneData,
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
          trainingZones: {
            include: {
              trainingZone: {
                select: { id: true, name: true, type: true, capacity: true, status: true },
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
