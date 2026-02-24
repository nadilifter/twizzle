import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";
import { z } from "zod";

function getCategoryLabel(category: {
  sportEvent?: { name: string; code: string } | null
  ageCategory?: { name: string; code: string } | null
  individualEntry?: { name: string } | null
  combinationEntry?: {
    rowValue: { name: string }
    colValue: { name: string }
  } | null
}): string {
  if (category.ageCategory && category.sportEvent) {
    return `${category.ageCategory.code} ${category.sportEvent.name}`
  }
  if (category.sportEvent) return category.sportEvent.name
  if (category.ageCategory) return category.ageCategory.name
  if (category.individualEntry?.name) return category.individualEntry.name
  if (category.combinationEntry) {
    return `${category.combinationEntry.rowValue.name} - ${category.combinationEntry.colValue.name}`
  }
  return "Event"
}

const updateAthleteSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  level: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "TRIAL", "GRADUATED"]).optional(),
  birthDate: z.string().optional().nullable(),
  guardianUserId: z.string().optional(),
});

// GET /api/athletes/[id]
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
    const athlete = await db.athlete.findFirst({
      where: {
        id,
        organizationAthletes: {
          some: { organizationId: session.user.organizationId },
        },
      },
      include: {
        organizationAthletes: {
          where: { organizationId: session.user.organizationId },
          select: { level: true, status: true, customId: true },
        },
        guardians: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { isPrimary: "desc" as const },
        },
        enrollments: {
          include: {
            program: true,
          },
        },
        attendances: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            event: {
              select: {
                id: true,
                title: true,
                date: true,
                type: true,
              },
            },
          },
        },
        evaluations: {
          orderBy: { date: "desc" },
          include: {
            coach: {
              select: {
                id: true,
                name: true,
              },
            },
            skillRatings: {
              include: {
                skill: true,
              },
            },
          },
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
                total: true,
              },
            },
          },
        },
      },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // Fetch memberships for this athlete
    const athleteMemberships = await db.athleteMembership.findMany({
      where: { athleteId: id },
      include: {
        instance: {
          include: {
            group: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const memberships = athleteMemberships.map((m) => ({
      id: m.id,
      instanceName: m.instance.name,
      groupName: m.instance.group.name,
      groupId: m.instance.group.id,
      status: m.status.toLowerCase(),
      startDate: m.startDate.toISOString(),
      endDate: m.endDate?.toISOString() ?? null,
    }));

    // Fetch waiver acceptances and signatures for this athlete
    const waiverAcceptances = await db.waiverAcceptance.findMany({
      where: { athleteId: id },
      include: {
        waiver: {
          include: {
            pages: {
              orderBy: { pageNumber: "asc" },
              select: { id: true, pageNumber: true, title: true, content: true },
            },
          },
        },
      },
    });

    const waiverSignatures = waiverAcceptances.length > 0
      ? await db.waiverSignature.findMany({
          where: {
            athleteId: id,
            waiverId: { in: waiverAcceptances.map((a) => a.waiverId) },
          },
          select: {
            id: true,
            waiverId: true,
            waiverPageId: true,
            signatureData: true,
            signedByName: true,
            signedByEmail: true,
            signedAt: true,
          },
        })
      : [];

    const signaturesByPage = new Map(
      waiverSignatures.map((s) => [s.waiverPageId, s])
    );

    const waivers = waiverAcceptances.map((a) => ({
      id: a.waiver.id,
      title: a.waiver.title,
      signed: true,
      signedAt: a.completedAt.toISOString(),
      pages: a.waiver.pages.map((p) => {
        const sig = signaturesByPage.get(p.id);
        return {
          id: p.id,
          pageNumber: p.pageNumber,
          title: p.title,
          content: p.content,
          signature: sig
            ? {
                signatureData: sig.signatureData,
                signedByName: sig.signedByName,
                signedByEmail: sig.signedByEmail,
                signedAt: sig.signedAt.toISOString(),
              }
            : null,
        };
      }),
    }));

    // Fetch competition entries for this athlete
    const competitionEntries = await db.competitionEntry.findMany({
      where: { athleteId: id },
      include: {
        competition: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            startTime: true,
            endTime: true,
            status: true,
            city: true,
            stateProvince: true,
            facility: { select: { id: true, name: true } },
          },
        },
        category: {
          include: {
            combinationEntry: { include: { rowValue: true, colValue: true } },
            individualEntry: true,
            sportEvent: { select: { name: true, code: true } },
            ageCategory: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch instance registrations (event sessions) for this athlete
    const instanceRegistrations = await db.instanceRegistration.findMany({
      where: { athleteId: id },
      include: {
        programInstance: {
          include: {
            program: { select: { id: true, name: true } },
            facility: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch medical info
    const medicalInfo = await db.athleteMedicalInfo.findUnique({
      where: { athleteId: id },
    });

    // Resolve level name and color from OrganizationAthlete
    const orgAthlete = athlete.organizationAthletes[0];
    const athleteLevel = orgAthlete?.level;
    let levelInfo: { id: string; name: string; color: string | null } | null = null;
    if (athleteLevel && athleteLevel !== "Unassigned") {
      const levelRecord = await db.level.findFirst({
        where: {
          organizationId: session.user.organizationId,
          OR: [{ id: athleteLevel }, { name: athleteLevel }],
        },
        select: { id: true, name: true, color: true },
      });
      levelInfo = levelRecord ?? { id: athleteLevel, name: athleteLevel, color: null };
    }

    const primaryGuardian = athlete.guardians.find((g) => g.isPrimary) || athlete.guardians[0];

    // Build unified registrations timeline
    type RegistrationItem = {
      id: string
      type: "competition" | "program" | "membership" | "waiver"
      name: string
      detail: string | null
      status: string
      date: string
      link: string | null
    }

    const registrations: RegistrationItem[] = []

    for (const entry of competitionEntries) {
      registrations.push({
        id: `comp-${entry.id}`,
        type: "competition",
        name: entry.competition.name,
        detail: getCategoryLabel(entry.category),
        status: entry.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        date: entry.createdAt.toISOString(),
        link: `/dashboard/competitions/${entry.competition.id}/athletes/${id}`,
      })
    }

    for (const enrollment of athlete.enrollments) {
      registrations.push({
        id: `prog-${enrollment.id}`,
        type: "program",
        name: enrollment.program?.name ?? "Unknown Program",
        detail: null,
        status: enrollment.status.charAt(0) + enrollment.status.slice(1).toLowerCase(),
        date: enrollment.createdAt.toISOString(),
        link: null,
      })
    }

    for (const m of athleteMemberships) {
      registrations.push({
        id: `memb-${m.id}`,
        type: "membership",
        name: m.instance.group.name,
        detail: m.instance.name,
        status: m.status.charAt(0) + m.status.slice(1).toLowerCase(),
        date: m.createdAt.toISOString(),
        link: null,
      })
    }

    for (const a of waiverAcceptances) {
      registrations.push({
        id: `waiv-${a.id}`,
        type: "waiver",
        name: a.waiver.title,
        detail: null,
        status: "Signed",
        date: a.completedAt.toISOString(),
        link: null,
      })
    }

    registrations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Transform competition entries for frontend
    const competitionEntriesFormatted = competitionEntries.map((entry) => ({
      id: entry.id,
      competitionId: entry.competitionId,
      competitionName: entry.competition.name,
      competitionStartDate: entry.competition.startDate.toISOString(),
      competitionEndDate: entry.competition.endDate.toISOString(),
      competitionStartTime: entry.competition.startTime,
      competitionEndTime: entry.competition.endTime,
      competitionStatus: entry.competition.status,
      location: [entry.competition.city, entry.competition.stateProvince].filter(Boolean).join(", ") || null,
      facilityName: (entry.competition as any).facility?.name ?? null,
      category: getCategoryLabel(entry.category),
      status: entry.status,
      createdAt: entry.createdAt.toISOString(),
      link: `/dashboard/competitions/${entry.competitionId}/athletes/${id}`,
    }))

    // Transform instance registrations for frontend
    const eventRegistrations = instanceRegistrations.map((reg) => ({
      id: reg.id,
      programInstanceId: reg.programInstanceId,
      programId: reg.programInstance.program.id,
      programName: reg.programInstance.program.name,
      date: reg.programInstance.date.toISOString(),
      startTime: reg.programInstance.startTime,
      endTime: reg.programInstance.endTime,
      instanceStatus: reg.programInstance.status,
      facilityName: reg.programInstance.facility?.name ?? null,
      status: reg.status,
      createdAt: reg.createdAt.toISOString(),
    }))

    const { organizationAthletes: _oa, ...athleteRest } = athlete;
    return NextResponse.json({
      ...athleteRest,
      level: orgAthlete?.level ?? "Unassigned",
      status: orgAthlete?.status ?? "ACTIVE",
      customId: orgAthlete?.customId ?? null,
      levelInfo,
      memberships,
      waivers,
      registrations,
      competitionEntries: competitionEntriesFormatted,
      eventRegistrations,
      medicalInfo: medicalInfo
        ? {
            id: medicalInfo.id,
            allergies: medicalInfo.allergies,
            medications: medicalInfo.medications,
            conditions: medicalInfo.conditions,
            dietaryRestrictions: medicalInfo.dietaryRestrictions,
            insuranceProvider: medicalInfo.insuranceProvider,
            insurancePolicyNumber: medicalInfo.insurancePolicyNumber,
            emergencyContactName: medicalInfo.emergencyContactName,
            emergencyContactPhone: medicalInfo.emergencyContactPhone,
            emergencyContactRelation: medicalInfo.emergencyContactRelation,
            additionalNotes: medicalInfo.additionalNotes,
            createdAt: medicalInfo.createdAt.toISOString(),
            updatedAt: medicalInfo.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching athlete:", error);
    return NextResponse.json(
      { error: "Failed to fetch athlete" },
      { status: 500 }
    );
  }
}

// PATCH /api/athletes/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Super admins bypass permission checks
    const permissions = session.user.permissions ?? [];
    const isSuperAdmin = session.user.isSuperAdmin === true;
    if (
      !isSuperAdmin &&
      !permissions.includes("*") &&
      !permissions.includes("athletes.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateAthleteSchema.parse(body);

    const existing = await db.athlete.findFirst({
      where: {
        id,
        organizationAthletes: {
          some: { organizationId: session.user.organizationId },
        },
      },
      include: {
        guardians: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // If changing guardian user, verify the user exists and update/create AthleteGuardian
    if (validatedData.guardianUserId) {
      const guardianUser = await db.user.findUnique({
        where: { id: validatedData.guardianUserId },
      });
      if (!guardianUser) {
        return NextResponse.json({ error: "Guardian user not found" }, { status: 404 });
      }

      const existingGuardian = existing.guardians.find(g => g.userId === validatedData.guardianUserId);

      if (existingGuardian) {
        await db.$transaction([
          db.athleteGuardian.updateMany({
            where: { athleteId: id, isPrimary: true },
            data: { isPrimary: false },
          }),
          db.athleteGuardian.update({
            where: { id: existingGuardian.id },
            data: { isPrimary: true },
          }),
        ]);
      } else {
        const currentPrimary = existing.guardians.find(g => g.isPrimary) || existing.guardians[0];
        if (currentPrimary) {
          await db.athleteGuardian.update({
            where: { id: currentPrimary.id },
            data: { userId: validatedData.guardianUserId },
          });
        } else {
          await db.athleteGuardian.create({
            data: {
              athleteId: id,
              userId: validatedData.guardianUserId,
              isPrimary: true,
              relationship: "Primary",
            },
          });
        }
      }
    }

    const { birthDate, guardianUserId, level, status, ...otherData } = validatedData;

    // Update org-specific fields on OrganizationAthlete
    const orgAthleteUpdate: Record<string, unknown> = {};
    if (level !== undefined) orgAthleteUpdate.level = level;
    if (status !== undefined) orgAthleteUpdate.status = status;

    if (Object.keys(orgAthleteUpdate).length > 0 && session.user.organizationId) {
      await db.organizationAthlete.updateMany({
        where: { athleteId: id, organizationId: session.user.organizationId },
        data: orgAthleteUpdate,
      });
    }

    const athlete = await db.athlete.update({
      where: { id },
      data: {
        ...otherData,
        ...(birthDate !== undefined && {
          birthDate: birthDate === null ? null : parseDateOnly(birthDate),
        }),
      },
      include: {
        organizationAthletes: {
          where: { organizationId: session.user.organizationId },
          select: { level: true, status: true, customId: true },
        },
        guardians: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        enrollments: {
          include: {
            program: true,
          },
        },
      },
    });

    const primaryGuardian = athlete.guardians.find((g) => g.isPrimary) || athlete.guardians[0];
    const updatedOrgAthlete = athlete.organizationAthletes[0];
    const { organizationAthletes: _oa2, ...updatedRest } = athlete;

    return NextResponse.json({
      ...updatedRest,
      level: updatedOrgAthlete?.level ?? "Unassigned",
      status: updatedOrgAthlete?.status ?? "ACTIVE",
      customId: updatedOrgAthlete?.customId ?? null,
      parent: primaryGuardian?.user?.name ?? "Unknown",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating athlete:", error);
    return NextResponse.json(
      { error: "Failed to update athlete" },
      { status: 500 }
    );
  }
}

// DELETE /api/athletes/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Super admins bypass permission checks
    const permissions = session.user.permissions ?? [];
    const isSuperAdmin = session.user.isSuperAdmin === true;
    if (
      !isSuperAdmin &&
      !permissions.includes("*") &&
      !permissions.includes("athletes.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.athlete.findFirst({
      where: {
        id,
        organizationAthletes: {
          some: { organizationId: session.user.organizationId },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    await db.athlete.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting athlete:", error);
    return NextResponse.json(
      { error: "Failed to delete athlete" },
      { status: 500 }
    );
  }
}
