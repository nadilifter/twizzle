import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb, db } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { parseDateOnly } from "@/lib/date-utils";
import { checkMemberCertifications } from "@/lib/services/certification-check";
import { logger } from "@/lib/logger";
import { z } from "zod";

const staffAssignmentSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(["LEAD", "ASSISTANT", "VOLUNTEER", "OBSERVER"]).default("ASSISTANT"),
  notes: z.string().optional(),
});

const createEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional(),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  type: z.enum(["CLASS", "CLINIC", "PARTY", "TRYOUT", "MEETING", "OTHER"]).default("CLASS"),
  description: z.string().optional(),
  meetingLink: z.string().optional(),
  timezone: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  facilityId: z.string().optional().nullable(),
  location: z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
    address: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
  details: z.object({
    whatToBring: z.array(z.string()).optional(),
    whatToExpect: z.string().optional(),
    requirements: z.string().optional(),
  }).optional(),
  programId: z.string().optional().nullable(),
  coachId: z.string().optional().nullable(),
  requiredMembershipInstanceIds: z.array(z.string()).optional(),
  hasGenderRestriction: z.boolean().optional(),
  allowedGenders: z.array(z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"])).optional(),
  hasFileRequirement: z.boolean().optional(),
  fileRequirementConfig: z.any().optional().nullable(),
  staffAssignments: z.array(staffAssignmentSchema).optional(),
  glCodeId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
}).refine((data) => {
  const dateTimeString = `${data.date}T${data.startTime}`;
  const eventDate = new Date(dateTimeString);
  const now = new Date();
  now.setSeconds(0, 0);
  
  return eventDate >= now;
}, {
  message: "Event date and time must be in the future",
  path: ["date"],
});

// GET /api/events
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const featureBlocked = await checkFeatureGate(session.user.organizationId, "events");
    if (featureBlocked) return featureBlocked;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type");
    const programId = searchParams.get("programId");
    const coachId = searchParams.get("coachId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    
    // Ensure organizationId is present
    if (!session.user.organizationId) {
        return NextResponse.json({ data: [], total: 0, limit, offset });
    }
    
    const where: any = {
      organizationId: session.user.organizationId,
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(type && { type: type as "CLASS" | "CLINIC" | "PARTY" | "TRYOUT" | "MEETING" | "OTHER" }),
      ...(programId && { programId }),
      ...(coachId && { coachId }),
      ...(startDate && endDate && {
        date: {
          gte: parseDateOnly(startDate)!,
          lte: parseDateOnly(endDate)!,
        },
      }),
    };

    const [events, total] = await Promise.all([
      db.event.findMany({
        where,
        include: {
          program: {
            select: {
              id: true,
              name: true,
            },
          },
          coach: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          facility: {
            select: {
              id: true,
              name: true,
              city: true,
              stateProvince: true,
            },
          },
          _count: {
            select: {
              attendances: true,
            },
          },
          requiredMemberships: {
            select: {
              id: true,
              name: true,
              group: {
                select: {
                  name: true
                }
              }
            }
          },
          staffAssignments: {
            include: {
              member: {
                include: {
                  user: {
                    select: {
                      name: true,
                      avatar: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { date: "asc" },
        take: limit,
        skip: offset,
      }),
      db.event.count({ where }),
    ]);

    // Transform for frontend compatibility
    const transformedEvents = events.map((event) => ({
      ...event,
      type: event.type,
      participants: [], // Will be populated from attendances
      attendanceCount: event._count.attendances,
    }));

    return NextResponse.json({
      data: transformedEvents,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

// POST /api/events
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const featureBlockedPost = await checkFeatureGate(session.user.organizationId, "events");
    if (featureBlockedPost) return featureBlockedPost;

    const permissions = session.user.permissions || [];
    if (
      !permissions.includes("*") &&
      !permissions.includes("events.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    logger.debug("POST /api/events body", { body });
    
    let validatedData;
    try {
        validatedData = createEventSchema.parse(body);
    } catch (zodError) {
        console.error("Zod validation error:", zodError);
        if (zodError instanceof z.ZodError) {
            return NextResponse.json(
                { error: zodError.issues[0]?.message || "Validation error" },
                { status: 400 }
            );
        }
        throw zodError;
    }

    // Use raw db to avoid scopedDb issues
    // const scopedDb = getScopedDb(session.user.organizationId);

    // Verify program if provided
    if (validatedData.programId) {
      const program = await db.program.findFirst({
        where: {
          id: validatedData.programId,
          organizationId: session.user.organizationId,
        },
      });
      if (!program) {
        return NextResponse.json({ error: "Program not found" }, { status: 404 });
      }
    }

    // Verify coach if provided
    if (validatedData.coachId) {
      const coach = await db.organizationMember.findFirst({
        where: {
          userId: validatedData.coachId,
          organizationId: session.user.organizationId,
          status: "ACTIVE",
        },
      });
      if (!coach) {
        return NextResponse.json({ error: "Coach not found" }, { status: 404 });
      }
    }

    // Verify facility if provided
    if (validatedData.facilityId) {
      const facility = await db.facility.findFirst({
        where: {
          id: validatedData.facilityId,
          organizationId: session.user.organizationId,
        },
      });
      if (!facility) {
        return NextResponse.json({ error: "Facility not found" }, { status: 404 });
      }
    }
    
    const scopedDb = getScopedDb(session.user.organizationId);

    if (validatedData.glCodeId) {
      const glCode = await scopedDb.gLCode.findUnique({ where: { id: validatedData.glCodeId } });
      if (!glCode) {
        return NextResponse.json({ error: "GL code not found" }, { status: 404 });
      }
    }
    if (validatedData.categoryId) {
      const cat = await scopedDb.category.findUnique({ where: { id: validatedData.categoryId }, select: { id: true } });
      if (!cat) return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (validatedData.requiredMembershipInstanceIds && validatedData.requiredMembershipInstanceIds.length > 0) {
      const validInstances = await db.membershipInstance.findMany({
        where: {
          id: { in: validatedData.requiredMembershipInstanceIds },
          group: { organizationId: session.user.organizationId },
        },
        select: { id: true },
      });
      if (validInstances.length !== validatedData.requiredMembershipInstanceIds.length) {
        return NextResponse.json({ error: "One or more membership instances not found" }, { status: 404 });
      }
    }

    const data: any = {
        title: validatedData.title,
        color: validatedData.color,
        date: parseDateOnly(validatedData.date)!,
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        type: validatedData.type,
        description: validatedData.description,
        meetingLink: validatedData.meetingLink,
        location: validatedData.location,
        details: validatedData.details,
        programId: validatedData.programId,
        coachId: validatedData.coachId,
        facilityId: validatedData.facilityId || null,
        timezone: validatedData.timezone,
        capacity: validatedData.capacity,
        hasGenderRestriction: validatedData.hasGenderRestriction ?? false,
        allowedGenders: validatedData.hasGenderRestriction ? (validatedData.allowedGenders ?? []) : [],
        hasFileRequirement: validatedData.hasFileRequirement ?? false,
        fileRequirementConfig: validatedData.fileRequirementConfig ?? undefined,
        glCodeId: validatedData.glCodeId ?? undefined,
        categoryId: validatedData.categoryId ?? undefined,
        organizationId: session.user.organizationId,
    };

    if (validatedData.requiredMembershipInstanceIds && validatedData.requiredMembershipInstanceIds.length > 0) {
        data.requiredMemberships = {
            connect: validatedData.requiredMembershipInstanceIds.map(id => ({ id }))
        };
    }

    if (validatedData.staffAssignments && validatedData.staffAssignments.length > 0) {
        for (const sa of validatedData.staffAssignments) {
          const certResult = await checkMemberCertifications(
            session.user.organizationId,
            sa.memberId,
            "events"
          );
          if (!certResult.valid) {
            return NextResponse.json(
              { error: "Missing required certifications", certifications: certResult.missing },
              { status: 422 }
            );
          }
        }

        data.staffAssignments = {
            create: validatedData.staffAssignments.map(sa => ({
                memberId: sa.memberId,
                role: sa.role,
                notes: sa.notes,
            })),
        };
    }

    const event = await db.event.create({
      data,
      include: {
        program: {
            select: {
              id: true,
              name: true,
            },
        },
        coach: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
        },
        facility: {
            select: {
              id: true,
              name: true,
              city: true,
              stateProvince: true,
            },
        },
        requiredMemberships: {
            select: {
              id: true,
              name: true,
              group: {
                select: {
                  name: true
                }
              }
            }
        },
        staffAssignments: {
            include: {
              member: {
                include: {
                  user: {
                    select: {
                      name: true,
                      avatar: true,
                    },
                  },
                },
              },
            },
        },
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error("Error creating event:", error);
    logger.debug("Event creation error details", { error: String(error) });
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
