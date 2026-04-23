import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { bumpCacheVersion } from "@/lib/cache-version";
import { parseDateOnly } from "@/lib/date-utils";
import { checkMemberCertifications, CertificationError } from "@/lib/services/certification-check";
import { z } from "zod";
import { imageUrlSchema } from "@/lib/schemas";
import { generateInstanceDates, calculateEndTime } from "@/lib/program-instance-utils";
import { getEnabledHolidayDates, filterOutHolidayDates } from "@/lib/holiday-utils";
import { bulkDiscountsSchema, validateBulkDiscountsForProgram } from "@/lib/bulk-discounts";

const updateProgramSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
    .optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  pricingModel: z.enum(["FLAT_RATE", "PER_SESSION"]).optional(),
  basePrice: z.number().min(0).optional().nullable(),
  perSessionPrice: z.number().min(0).optional().nullable(),
  billingInterval: z.enum(["ONE_TIME", "MONTHLY", "YEARLY", "SESSION"]).optional(),
  recurringPrice: z.number().min(0).optional().nullable(),
  registrationType: z.enum(["ALL_INSTANCES", "PER_INSTANCE"]).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  startTime: z.string().optional().nullable(),
  duration: z.number().int().min(1).optional().nullable(),
  rrule: z.string().optional().nullable(),
  facilityId: z.string().optional().nullable(),
  capacity: z.number().int().min(1).optional().nullable(),
  showCoachOnSite: z.boolean().optional(),
  imageUrl: imageUrlSchema.optional().nullable(),
  // Age restrictions
  minAge: z.number().int().min(0).max(100).optional().nullable(),
  maxAge: z.number().int().min(0).max(100).optional().nullable(),
  // Space capacity
  hasSpaceRestriction: z.boolean().optional(),
  spaceCapacityMode: z.enum(["MINIMUM", "SUM"]).optional(),
  // Restriction flags
  hasGenderRestriction: z.boolean().optional(),
  hasLevelRestriction: z.boolean().optional(),
  hasCapacityRestriction: z.boolean().optional(),
  hasAgeRestriction: z.boolean().optional(),
  hasMembershipRestriction: z.boolean().optional(),
  hasPassRestriction: z.boolean().optional(),
  hasWaiverRestriction: z.boolean().optional(),
  hasMedicalRequirement: z.boolean().optional(),
  hasFileRequirement: z.boolean().optional(),
  fileRequirementConfig: z.any().optional().nullable(),
  // Gender restriction values
  allowedGenders: z.array(z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"])).optional(),
  // Waitlist
  waitlistEnabled: z.boolean().optional(),
  waitlistAutoPromote: z.boolean().optional(),
  waitlistCapacity: z.number().int().min(1).optional().nullable(),
  // Related data for updates
  levelRequirementIds: z.array(z.string()).optional(),
  membershipRequirementIds: z.array(z.string()).optional(),
  passRequirementIds: z.array(z.string()).optional(),
  waiverRequirementIds: z.array(z.string()).optional(),
  spaceIds: z.array(z.string()).optional(),
  staffAssignments: z
    .array(
      z.object({
        memberId: z.string(),
        role: z
          .enum(["LEAD_COACH", "ASSISTANT_COACH", "SUBSTITUTE", "VOLUNTEER"])
          .default("ASSISTANT_COACH"),
        isPrimary: z.boolean().default(false),
      })
    )
    .optional(),
  glCodeId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  // Bulk discounts — full replacement when provided
  bulkDiscounts: bulkDiscountsSchema,
  // Registration window
  registrationStartDate: z.string().optional().nullable(),
  registrationStartTime: z.string().optional().nullable(),
  registrationEndDate: z.string().optional().nullable(),
  registrationEndTime: z.string().optional().nullable(),
  registrationOpen: z.boolean().optional(),
  earlyAccessCode: z.string().optional().nullable(),
  // Flag to regenerate instances
  regenerateInstances: z.boolean().optional(),
});

// GET /api/programs/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
          orderBy: [{ isPrimary: "desc" }, { role: "asc" }],
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
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            athlete: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        instances: {
          orderBy: { date: "asc" },
          take: 20,
          include: {
            _count: {
              select: { registrations: true, attendances: true },
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
          // Safety limit — the Transactions tab renders this array client-side.
          // Programs with more than 500 line items are vanishingly rare today;
          // paginate via a dedicated endpoint if this becomes constraining.
          take: 500,
          include: {
            invoice: {
              select: {
                id: true,
                reference: true,
                status: true,
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
            athlete: {
              select: { id: true, name: true, avatar: true },
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

    if (!program) {
      const existsElsewhere = await db.program.findFirst({
        where: { id },
        select: { organizationId: true, organization: { select: { name: true } } },
      });

      if (existsElsewhere) {
        return NextResponse.json(
          {
            error: "This program belongs to a different organization",
            code: "ORG_MISMATCH",
            organizationId: existsElsewhere.organizationId,
            organizationName: existsElsewhere.organization?.name ?? null,
          },
          { status: 404 }
        );
      }

      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    return NextResponse.json(program);
  } catch (error) {
    console.error("Error fetching program:", error);
    return NextResponse.json({ error: "Failed to fetch program" }, { status: 500 });
  }
}

// PATCH /api/programs/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Validate all client-provided foreign keys belong to this org
    const scopedDb = getScopedDb(session.user.organizationId);
    if (validatedData.facilityId) {
      const facility = await scopedDb.facility.findUnique({
        where: { id: validatedData.facilityId },
      });
      if (!facility) return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }
    if (validatedData.glCodeId) {
      const glCode = await scopedDb.gLCode.findUnique({ where: { id: validatedData.glCodeId } });
      if (!glCode) return NextResponse.json({ error: "GL code not found" }, { status: 404 });
    }
    if (validatedData.categoryId) {
      const cat = await scopedDb.category.findUnique({
        where: { id: validatedData.categoryId },
        select: { id: true },
      });
      if (!cat) return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if (validatedData.levelRequirementIds?.length) {
      const valid = await scopedDb.level.findMany({
        where: { id: { in: validatedData.levelRequirementIds } },
        select: { id: true },
      });
      if (valid.length !== validatedData.levelRequirementIds.length)
        return NextResponse.json({ error: "One or more levels not found" }, { status: 404 });
    }
    if (validatedData.waiverRequirementIds?.length) {
      const valid = await scopedDb.waiver.findMany({
        where: { id: { in: validatedData.waiverRequirementIds } },
        select: { id: true },
      });
      if (valid.length !== validatedData.waiverRequirementIds.length)
        return NextResponse.json({ error: "One or more waivers not found" }, { status: 404 });
    }
    if (validatedData.membershipRequirementIds?.length) {
      const valid = await db.membershipInstance.findMany({
        where: {
          id: { in: validatedData.membershipRequirementIds },
          group: { organizationId: session.user.organizationId },
        },
        select: { id: true },
      });
      if (valid.length !== validatedData.membershipRequirementIds.length)
        return NextResponse.json(
          { error: "One or more membership instances not found" },
          { status: 404 }
        );
    }
    if (validatedData.passRequirementIds?.length) {
      const valid = await scopedDb.pass.findMany({
        where: { id: { in: validatedData.passRequirementIds } },
        select: { id: true },
      });
      if (valid.length !== validatedData.passRequirementIds.length)
        return NextResponse.json({ error: "One or more passes not found" }, { status: 404 });
    }
    if (validatedData.spaceIds?.length) {
      const valid = await db.space.findMany({
        where: {
          id: { in: validatedData.spaceIds },
          facility: { organizationId: session.user.organizationId },
        },
        select: { id: true },
      });
      if (valid.length !== validatedData.spaceIds.length)
        return NextResponse.json({ error: "One or more spaces not found" }, { status: 404 });
    }

    // Validate bulk discount business rules server-side
    if (validatedData.bulkDiscounts?.length) {
      const err = validateBulkDiscountsForProgram(validatedData.bulkDiscounts, {
        billingInterval: validatedData.billingInterval ?? existing.billingInterval,
        basePrice:
          validatedData.basePrice !== undefined
            ? validatedData.basePrice
            : Number(existing.basePrice),
        perSessionPrice:
          validatedData.perSessionPrice !== undefined
            ? validatedData.perSessionPrice
            : Number(existing.perSessionPrice),
        recurringPrice:
          validatedData.recurringPrice !== undefined
            ? validatedData.recurringPrice
            : Number(existing.recurringPrice),
      });
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    // Pre-compute holiday dates outside the transaction
    const holidayStartDate = validatedData.startDate
      ? parseDateOnly(validatedData.startDate)
      : existing.startDate;
    const holidayEndDate = validatedData.endDate
      ? parseDateOnly(validatedData.endDate)
      : existing.endDate;
    const holidayDates = holidayStartDate
      ? await getEnabledHolidayDates(
          session.user.organizationId!,
          holidayStartDate,
          holidayEndDate || holidayStartDate
        )
      : new Set<string>();

    const program = await db.$transaction(async (tx) => {
      const verified = await tx.program.findFirst({
        where: { id, organizationId: session.user.organizationId },
        select: { id: true },
      });
      if (!verified) throw new Error("Program not found or access denied");

      const updateData: Record<string, unknown> = {};

      if (validatedData.name !== undefined) updateData.name = validatedData.name;
      if (validatedData.description !== undefined)
        updateData.description = validatedData.description;
      if (validatedData.color !== undefined) updateData.color = validatedData.color;
      if (validatedData.status !== undefined) updateData.status = validatedData.status;
      if (validatedData.pricingModel !== undefined)
        updateData.pricingModel = validatedData.pricingModel;
      if (validatedData.basePrice !== undefined) updateData.basePrice = validatedData.basePrice;
      if (validatedData.perSessionPrice !== undefined)
        updateData.perSessionPrice = validatedData.perSessionPrice;
      if (validatedData.billingInterval !== undefined)
        updateData.billingInterval = validatedData.billingInterval;
      if (validatedData.recurringPrice !== undefined)
        updateData.recurringPrice = validatedData.recurringPrice;
      if (validatedData.registrationType !== undefined)
        updateData.registrationType = validatedData.registrationType;
      if (validatedData.startDate !== undefined)
        updateData.startDate = validatedData.startDate
          ? parseDateOnly(validatedData.startDate)
          : null;
      if (validatedData.endDate !== undefined)
        updateData.endDate = validatedData.endDate ? parseDateOnly(validatedData.endDate) : null;
      if (validatedData.startTime !== undefined) updateData.startTime = validatedData.startTime;
      if (validatedData.duration !== undefined) updateData.duration = validatedData.duration;
      if (validatedData.rrule !== undefined) updateData.rrule = validatedData.rrule;
      if (validatedData.facilityId !== undefined) updateData.facilityId = validatedData.facilityId;
      if (validatedData.capacity !== undefined) updateData.capacity = validatedData.capacity;
      if (validatedData.showCoachOnSite !== undefined)
        updateData.showCoachOnSite = validatedData.showCoachOnSite;
      if (validatedData.imageUrl !== undefined) updateData.imageUrl = validatedData.imageUrl;
      // Age and restriction fields
      if (validatedData.minAge !== undefined) updateData.minAge = validatedData.minAge;
      if (validatedData.maxAge !== undefined) updateData.maxAge = validatedData.maxAge;
      if (validatedData.hasLevelRestriction !== undefined)
        updateData.hasLevelRestriction = validatedData.hasLevelRestriction;
      if (validatedData.hasCapacityRestriction !== undefined)
        updateData.hasCapacityRestriction = validatedData.hasCapacityRestriction;
      if (validatedData.hasAgeRestriction !== undefined)
        updateData.hasAgeRestriction = validatedData.hasAgeRestriction;
      if (validatedData.hasGenderRestriction !== undefined) {
        updateData.hasGenderRestriction = validatedData.hasGenderRestriction;
        updateData.allowedGenders = validatedData.hasGenderRestriction
          ? (validatedData.allowedGenders ?? [])
          : [];
      } else if (validatedData.allowedGenders !== undefined) {
        updateData.allowedGenders = validatedData.allowedGenders;
      }
      if (validatedData.hasMembershipRestriction !== undefined)
        updateData.hasMembershipRestriction = validatedData.hasMembershipRestriction;
      if (validatedData.hasPassRestriction !== undefined)
        updateData.hasPassRestriction = validatedData.hasPassRestriction;
      if (validatedData.hasWaiverRestriction !== undefined)
        updateData.hasWaiverRestriction = validatedData.hasWaiverRestriction;
      if (validatedData.hasMedicalRequirement !== undefined)
        updateData.hasMedicalRequirement = validatedData.hasMedicalRequirement;
      if (validatedData.hasFileRequirement !== undefined)
        updateData.hasFileRequirement = validatedData.hasFileRequirement;
      if (validatedData.fileRequirementConfig !== undefined)
        updateData.fileRequirementConfig = validatedData.fileRequirementConfig;
      if (validatedData.hasSpaceRestriction !== undefined)
        updateData.hasSpaceRestriction = validatedData.hasSpaceRestriction;
      if (validatedData.spaceCapacityMode !== undefined)
        updateData.spaceCapacityMode = validatedData.spaceCapacityMode;
      if (validatedData.waitlistEnabled !== undefined)
        updateData.waitlistEnabled = validatedData.waitlistEnabled;
      if (validatedData.waitlistAutoPromote !== undefined)
        updateData.waitlistAutoPromote = validatedData.waitlistAutoPromote;
      if (validatedData.waitlistCapacity !== undefined)
        updateData.waitlistCapacity = validatedData.waitlistCapacity;
      if (validatedData.glCodeId !== undefined) updateData.glCodeId = validatedData.glCodeId;
      if (validatedData.categoryId !== undefined) updateData.categoryId = validatedData.categoryId;
      if (validatedData.registrationStartDate !== undefined)
        updateData.registrationStartDate = validatedData.registrationStartDate
          ? parseDateOnly(validatedData.registrationStartDate)
          : null;
      if (validatedData.registrationStartTime !== undefined)
        updateData.registrationStartTime = validatedData.registrationStartTime;
      if (validatedData.registrationEndDate !== undefined)
        updateData.registrationEndDate = validatedData.registrationEndDate
          ? parseDateOnly(validatedData.registrationEndDate)
          : null;
      if (validatedData.registrationEndTime !== undefined)
        updateData.registrationEndTime = validatedData.registrationEndTime;
      if (validatedData.registrationOpen !== undefined)
        updateData.registrationOpen = validatedData.registrationOpen;
      if (validatedData.earlyAccessCode !== undefined)
        updateData.earlyAccessCode = validatedData.earlyAccessCode;

      // Update the program
      const updatedProgram = await tx.program.update({
        where: { id },
        data: updateData,
      });

      // Regenerate instances if explicitly requested or if schedule fields changed
      const scheduleChanged =
        (validatedData.startDate !== undefined &&
          parseDateOnly(validatedData.startDate)?.getTime() !== existing.startDate?.getTime()) ||
        (validatedData.endDate !== undefined &&
          parseDateOnly(validatedData.endDate)?.getTime() !== existing.endDate?.getTime()) ||
        (validatedData.startTime !== undefined &&
          validatedData.startTime !== (existing as any).startTime) ||
        (validatedData.duration !== undefined &&
          validatedData.duration !== (existing as any).duration) ||
        (validatedData.rrule !== undefined && validatedData.rrule !== (existing as any).rrule);

      if (validatedData.regenerateInstances || scheduleChanged) {
        // Delete existing future instances (preserve past ones with registrations)
        await tx.programInstance.deleteMany({
          where: {
            programId: id,
            date: { gte: new Date() },
            registrations: { none: {} },
          },
        });

        // Generate new instances
        const startDate = validatedData.startDate
          ? parseDateOnly(validatedData.startDate)
          : existing.startDate;
        const endDate = validatedData.endDate
          ? parseDateOnly(validatedData.endDate)
          : existing.endDate;
        const startTime = validatedData.startTime ?? (existing as any).startTime;
        const duration = validatedData.duration ?? (existing as any).duration;
        const rrule = validatedData.rrule ?? (existing as any).rrule;
        const facilityId = validatedData.facilityId ?? (existing as any).facilityId;
        const capacity = validatedData.capacity ?? existing.capacity;

        if (startDate && startTime && duration) {
          const endTime = calculateEndTime(startTime, duration);
          const allDates = rrule
            ? generateInstanceDates(startDate, endDate || startDate, rrule)
            : [startDate];

          // Filter to only future dates, then exclude holidays
          const futureDatesUnfiltered = allDates.filter((d) => d >= new Date());
          const futureDates = filterOutHolidayDates(futureDatesUnfiltered, holidayDates);

          if (futureDates.length > 0) {
            await tx.programInstance.createMany({
              data: futureDates.map((date) => ({
                programId: id,
                date,
                startTime,
                endTime,
                facilityId,
                capacity,
                organizationId: session.user.organizationId!,
              })),
            });

            // Carry forward program-level space assignments to new instances
            // (skip if spaceIds is in the payload — the space-sync block below handles that)
            if (validatedData.spaceIds === undefined) {
              const programSpaces = await tx.programSpace.findMany({
                where: { programId: id },
                select: { spaceId: true },
              });
              if (programSpaces.length > 0) {
                const newInstances = await tx.programInstance.findMany({
                  where: { programId: id, date: { gte: new Date() } },
                  select: { id: true },
                });
                const instanceSpaceData = newInstances.flatMap((inst) =>
                  programSpaces.map((ps) => ({
                    programInstanceId: inst.id,
                    spaceId: ps.spaceId,
                  }))
                );
                await tx.programInstanceSpace.createMany({
                  data: instanceSpaceData,
                });
              }
            }
          }
        }
      }

      // Update level requirements if provided
      if (validatedData.levelRequirementIds !== undefined) {
        // Delete existing requirements
        await tx.programLevelRequirement.deleteMany({
          where: { programId: id },
        });
        // Create new requirements
        if (validatedData.levelRequirementIds.length > 0) {
          await tx.programLevelRequirement.createMany({
            data: validatedData.levelRequirementIds.map((levelId) => ({
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
              set: validatedData.membershipRequirementIds.map((membId) => ({ id: membId })),
            },
          },
        });
      }

      // Update pass requirements if provided
      if (validatedData.passRequirementIds !== undefined) {
        await tx.program.update({
          where: { id },
          data: {
            requiredPasses: {
              set: validatedData.passRequirementIds.map((passId) => ({ id: passId })),
            },
          },
        });
      }

      // Update waiver requirements if provided
      if (validatedData.waiverRequirementIds !== undefined) {
        await tx.programWaiverRequirement.deleteMany({
          where: { programId: id },
        });
        if (validatedData.waiverRequirementIds.length > 0) {
          await tx.programWaiverRequirement.createMany({
            data: validatedData.waiverRequirementIds.map((waiverId) => ({
              programId: id,
              waiverId,
            })),
          });
        }
      }

      // Update staff assignments if provided (with certification enforcement)
      if (validatedData.staffAssignments !== undefined) {
        for (const sa of validatedData.staffAssignments) {
          const certResult = await checkMemberCertifications(
            session.user.organizationId!,
            sa.memberId,
            "programs"
          );
          if (!certResult.valid) {
            throw new CertificationError(certResult.missing);
          }
        }
        await tx.programStaff.deleteMany({
          where: { programId: id },
        });
        if (validatedData.staffAssignments.length > 0) {
          await tx.programStaff.createMany({
            data: validatedData.staffAssignments.map((sa) => ({
              programId: id,
              memberId: sa.memberId,
              role: sa.role,
              isPrimary: sa.isPrimary,
            })),
          });
        }
      }

      // Update space assignments if provided
      if (validatedData.spaceIds !== undefined) {
        await tx.programSpace.deleteMany({
          where: { programId: id },
        });
        if (validatedData.spaceIds.length > 0) {
          await tx.programSpace.createMany({
            data: validatedData.spaceIds.map((spaceId) => ({
              programId: id,
              spaceId,
            })),
          });
        }

        // Update instance-level space assignments for future instances
        const futureInstances = await tx.programInstance.findMany({
          where: {
            programId: id,
            date: { gte: new Date() },
          },
          select: { id: true },
        });

        if (futureInstances.length > 0) {
          const instanceIds = futureInstances.map((i) => i.id);
          await tx.programInstanceSpace.deleteMany({
            where: { programInstanceId: { in: instanceIds } },
          });

          if (validatedData.spaceIds.length > 0) {
            const instanceSpaceData = futureInstances.flatMap((inst) =>
              validatedData.spaceIds!.map((spaceId) => ({
                programInstanceId: inst.id,
                spaceId,
              }))
            );
            await tx.programInstanceSpace.createMany({
              data: instanceSpaceData,
            });
          }
        }
      }

      // Replace bulk discounts if provided (full replace, inside transaction for atomicity)
      if (validatedData.bulkDiscounts) {
        await tx.programBulkDiscount.deleteMany({ where: { programId: id } });
        if (validatedData.bulkDiscounts.length > 0) {
          await tx.programBulkDiscount.createMany({
            data: validatedData.bulkDiscounts.map((d) => ({
              programId: id,
              type: d.type,
              minQuantity: d.minQuantity,
              discountType: d.discountType,
              discountValue: d.discountValue,
            })),
          });
        }
      }

      // Fetch and return the updated program with all relations
      return tx.program.findUnique({
        where: { id },
        include: {
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
          instances: {
            orderBy: { date: "asc" },
            take: 20,
            include: {
              _count: {
                select: { registrations: true, attendances: true },
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

    if (!program) {
      return NextResponse.json({ error: "Failed to update program" }, { status: 500 });
    }

    await bumpCacheVersion(session.user.organizationId, "programs");

    return NextResponse.json(program);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof CertificationError) {
      return NextResponse.json(
        { error: "Missing required certifications", certifications: error.certifications },
        { status: 422 }
      );
    }
    console.error("Error updating program:", error);
    return NextResponse.json({ error: "Failed to update program" }, { status: 500 });
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

    const scopedDb = getScopedDb(session.user.organizationId);
    await scopedDb.program.delete({ where: { id } });

    await bumpCacheVersion(session.user.organizationId, "programs");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting program:", error);
    return NextResponse.json({ error: "Failed to delete program" }, { status: 500 });
  }
}
