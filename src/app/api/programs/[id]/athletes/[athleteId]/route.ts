import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { AthleteWaiverSummary } from "@/types/athletes";

/**
 * GET /api/programs/[id]/athletes/[athleteId]
 * Full participation details for one athlete in a program, scoped to this program only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; athleteId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const { id: programId, athleteId } = await params;

    const program = await db.program.findFirst({
      where: { id: programId, organizationId },
      select: {
        id: true,
        name: true,
        registrationType: true,
        hasLevelRestriction: true,
        hasMembershipRestriction: true,
        hasWaiverRestriction: true,
        hasMedicalRequirement: true,
        requiredMemberships: { select: { id: true } },
        waiverRequirements: { select: { waiverId: true } },
      },
    });
    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const athlete = await db.athlete.findFirst({
      where: { id: athleteId, organizationAthletes: { some: { organizationId } } },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        birthDate: true,
        gender: true,
        organizationAthletes: {
          where: { organizationId },
          select: { level: true },
        },
        guardians: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
          orderBy: { isPrimary: "desc" },
        },
      },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // Verify athlete is actually in this program (enrolled or has at least one instance registration)
    const [enrollmentCount, regCount] = await Promise.all([
      db.enrollment.count({
        where: { programId, athleteId, status: { not: "CANCELLED" } },
      }),
      db.instanceRegistration.count({
        where: {
          athleteId,
          status: { not: "CANCELLED" },
          programInstance: { programId },
        },
      }),
    ]);
    if (enrollmentCount === 0 && regCount === 0) {
      return NextResponse.json(
        { error: "Athlete is not registered for this program" },
        { status: 404 }
      );
    }

    const guardians = athlete.guardians
      .filter((g) => g.user != null)
      .map((g) => ({
        id: g.user!.id,
        name: g.user!.name,
        email: g.user!.email,
        phone: g.user!.phone,
        relationship: g.relationship,
        isPrimary: g.isPrimary,
      }));

    const orgAthleteLevel = athlete.organizationAthletes[0]?.level ?? null;
    const needLevelLookup = orgAthleteLevel != null && orgAthleteLevel !== "Unassigned";

    // Safety limit on history queries — prevents a single athlete with years of
    // participation from returning an unbounded payload. UI fetches a summary;
    // deeper history is deferred to a paginated follow-up if needed.
    const HISTORY_LIMIT = 200;

    // Fetch all program-scoped data for this athlete + level lookup in parallel.
    const [enrollments, instanceRegistrations, attendances, evaluations, lineItems, levelRecord] =
      await Promise.all([
        db.enrollment.findMany({
          where: { programId, athleteId },
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: HISTORY_LIMIT,
        }),
        db.instanceRegistration.findMany({
          where: { athleteId, programInstance: { programId } },
          select: {
            id: true,
            status: true,
            createdAt: true,
            programInstance: {
              select: {
                id: true,
                date: true,
                startTime: true,
                endTime: true,
                status: true,
                facility: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: HISTORY_LIMIT,
        }),
        db.instanceAttendance.findMany({
          where: { athleteId, programInstance: { programId } },
          select: {
            id: true,
            status: true,
            checkedIn: true,
            notes: true,
            programInstance: {
              select: { id: true, date: true, startTime: true, endTime: true },
            },
          },
          orderBy: { programInstance: { date: "desc" } },
          take: HISTORY_LIMIT,
        }),
        db.evaluation.findMany({
          where: {
            athleteId,
            OR: [{ programId }, { programInstance: { programId } }],
          },
          select: {
            id: true,
            date: true,
            overallScore: true,
            status: true,
            notes: true,
            template: { select: { id: true, name: true } },
            coach: { select: { id: true, name: true } },
            programInstance: { select: { id: true, date: true } },
          },
          orderBy: { date: "desc" },
          take: HISTORY_LIMIT,
        }),
        db.lineItem.findMany({
          where: { programId, athleteId },
          include: {
            invoice: {
              select: {
                id: true,
                reference: true,
                status: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: HISTORY_LIMIT,
        }),
        needLevelLookup
          ? db.level.findFirst({
              where: { id: orgAthleteLevel!, organizationId },
              select: { id: true, name: true },
            })
          : Promise.resolve(null),
      ]);

    const level: { id: string; name: string } | null = needLevelLookup
      ? (levelRecord ?? { id: orgAthleteLevel!, name: orgAthleteLevel! })
      : null;

    // Compliance — fetch the independent sets in parallel, only for active requirements.
    // Medical custom responses are scoped to THIS org's questions (the standard
    // medical fields are cross-tenant per-athlete; custom questions are org-specific).
    const requiredMembershipIds = program.requiredMemberships.map((m) => m.id);
    const requiredWaiverIds = program.waiverRequirements.map((w) => w.waiverId);
    const needMembership = program.hasMembershipRestriction && requiredMembershipIds.length > 0;
    const needWaivers = program.hasWaiverRestriction && requiredWaiverIds.length > 0;
    const needMedical = program.hasMedicalRequirement;

    type MedicalInfoRow = {
      id: string;
      allergies: string[];
      medications: string[];
      conditions: string[];
      dietaryRestrictions: string[];
      insuranceProvider: string | null;
      insurancePolicyNumber: string | null;
      emergencyContactName: string | null;
      emergencyContactPhone: string | null;
      emergencyContactRelation: string | null;
      additionalNotes: string | null;
      createdAt: Date;
      updatedAt: Date;
      customResponses: {
        id: string;
        questionId: string;
        response: string;
        createdAt: Date;
        updatedAt: Date;
        question: {
          id: string;
          questionText: string;
          questionType: string;
          options: unknown;
          required: boolean;
          displayOrder: number;
        };
      }[];
    } | null;

    const [
      requiredInstances,
      athleteMemberships,
      requiredWaivers,
      acceptances,
      waiverSignatures,
      medicalInfoRaw,
    ] = (await Promise.all([
      needMembership
        ? db.membershipInstance.findMany({
            where: { id: { in: requiredMembershipIds }, group: { organizationId } },
            select: { id: true, name: true, group: { select: { name: true } } },
          })
        : Promise.resolve([] as { id: string; name: string; group: { name: string } }[]),
      needMembership
        ? db.athleteMembership.findMany({
            where: { athleteId, membershipInstanceId: { in: requiredMembershipIds } },
            select: { membershipInstanceId: true, status: true },
          })
        : Promise.resolve([] as { membershipInstanceId: string; status: string }[]),
      needWaivers
        ? db.waiver.findMany({
            where: { id: { in: requiredWaiverIds }, organizationId },
            select: {
              id: true,
              title: true,
              pages: {
                orderBy: { pageNumber: "asc" },
                select: { id: true, pageNumber: true, title: true, content: true },
              },
            },
          })
        : Promise.resolve(
            [] as {
              id: string;
              title: string;
              pages: { id: string; pageNumber: number; title: string | null; content: string }[];
            }[]
          ),
      needWaivers
        ? db.waiverAcceptance.findMany({
            where: { athleteId, waiverId: { in: requiredWaiverIds } },
            select: { waiverId: true, completedAt: true },
          })
        : Promise.resolve([] as { waiverId: string; completedAt: Date | null }[]),
      needWaivers
        ? db.waiverSignature.findMany({
            where: { athleteId, waiverId: { in: requiredWaiverIds } },
            select: {
              waiverPageId: true,
              signatureData: true,
              signedByName: true,
              signedByEmail: true,
              signedAt: true,
            },
          })
        : Promise.resolve(
            [] as {
              waiverPageId: string;
              signatureData: string;
              signedByName: string;
              signedByEmail: string;
              signedAt: Date;
            }[]
          ),
      needMedical
        ? db.athleteMedicalInfo.findUnique({
            where: { athleteId },
            select: {
              id: true,
              allergies: true,
              medications: true,
              conditions: true,
              dietaryRestrictions: true,
              insuranceProvider: true,
              insurancePolicyNumber: true,
              emergencyContactName: true,
              emergencyContactPhone: true,
              emergencyContactRelation: true,
              additionalNotes: true,
              createdAt: true,
              updatedAt: true,
              customResponses: {
                // Scope custom responses to THIS org's questions only — the
                // CustomMedicalQuestion model is org-scoped even though the
                // parent AthleteMedicalInfo row is shared across orgs.
                where: { question: { organizationId } },
                select: {
                  id: true,
                  questionId: true,
                  response: true,
                  createdAt: true,
                  updatedAt: true,
                  question: {
                    select: {
                      id: true,
                      questionText: true,
                      questionType: true,
                      options: true,
                      required: true,
                      displayOrder: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve(null),
    ])) as [
      { id: string; name: string; group: { name: string } }[],
      { membershipInstanceId: string; status: string }[],
      {
        id: string;
        title: string;
        pages: { id: string; pageNumber: number; title: string | null; content: string }[];
      }[],
      { waiverId: string; completedAt: Date | null }[],
      {
        waiverPageId: string;
        signatureData: string;
        signedByName: string;
        signedByEmail: string;
        signedAt: Date;
      }[],
      MedicalInfoRow,
    ];

    const compliance: {
      membership: {
        required: boolean;
        status: string;
        memberships: { name: string; groupName: string; status: string }[];
      };
      waivers: {
        required: boolean;
        status: string;
        waivers: AthleteWaiverSummary[];
      };
      medical: {
        required: boolean;
        status: string;
        info: Record<string, unknown> | null;
      };
    } = {
      membership: { required: false, status: "not_required", memberships: [] },
      waivers: { required: false, status: "not_required", waivers: [] },
      medical: { required: false, status: "not_required", info: null },
    };

    if (needMembership) {
      compliance.membership.required = true;
      const statusMap = new Map(athleteMemberships.map((m) => [m.membershipInstanceId, m.status]));
      compliance.membership.memberships = requiredInstances.map((inst) => {
        const status = statusMap.get(inst.id);
        return {
          name: inst.name,
          groupName: inst.group.name,
          status: status === "ACTIVE" ? "active" : status ? String(status).toLowerCase() : "none",
        };
      });
      compliance.membership.status = athleteMemberships.some((m) => m.status === "ACTIVE")
        ? "verified"
        : "missing";
    }

    if (needWaivers) {
      compliance.waivers.required = true;
      const acceptanceMap = new Map(acceptances.map((a) => [a.waiverId, a.completedAt]));
      const signaturesByPage = new Map(waiverSignatures.map((s) => [s.waiverPageId, s]));
      compliance.waivers.waivers = requiredWaivers.map((w) => {
        const completedAt = acceptanceMap.get(w.id);
        return {
          id: w.id,
          title: w.title,
          signed: !!completedAt,
          signedAt: completedAt?.toISOString() ?? null,
          pages: w.pages.map((p) => {
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
        };
      });
      compliance.waivers.status = compliance.waivers.waivers.every((w) => w.signed)
        ? "signed"
        : "unsigned";
    }

    if (needMedical) {
      compliance.medical.required = true;
      compliance.medical.status = medicalInfoRaw ? "complete" : "incomplete";
      compliance.medical.info = medicalInfoRaw
        ? {
            id: medicalInfoRaw.id,
            allergies: medicalInfoRaw.allergies,
            medications: medicalInfoRaw.medications,
            conditions: medicalInfoRaw.conditions,
            dietaryRestrictions: medicalInfoRaw.dietaryRestrictions,
            insuranceProvider: medicalInfoRaw.insuranceProvider,
            insurancePolicyNumber: medicalInfoRaw.insurancePolicyNumber,
            emergencyContactName: medicalInfoRaw.emergencyContactName,
            emergencyContactPhone: medicalInfoRaw.emergencyContactPhone,
            emergencyContactRelation: medicalInfoRaw.emergencyContactRelation,
            additionalNotes: medicalInfoRaw.additionalNotes,
            createdAt: medicalInfoRaw.createdAt.toISOString(),
            updatedAt: medicalInfoRaw.updatedAt.toISOString(),
            customResponses: medicalInfoRaw.customResponses.map((r) => ({
              id: r.id,
              questionId: r.questionId,
              response: r.response,
              question: r.question,
              createdAt: r.createdAt.toISOString(),
              updatedAt: r.updatedAt.toISOString(),
            })),
          }
        : null;
    }

    return NextResponse.json({
      programName: program.name,
      registrationType: program.registrationType,
      athlete: {
        id: athlete.id,
        name: athlete.name,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        email: athlete.email,
        avatar: athlete.avatar,
        birthDate: athlete.birthDate,
        gender: athlete.gender,
        level,
        guardians,
      },
      enrollments,
      instanceRegistrations,
      attendances,
      evaluations,
      lineItems,
      compliance,
      requirements: {
        hasLevelRestriction: program.hasLevelRestriction,
        hasMembershipRestriction: program.hasMembershipRestriction,
        hasWaiverRestriction: program.hasWaiverRestriction,
        hasMedicalRequirement: program.hasMedicalRequirement,
      },
    });
  } catch (error) {
    console.error("Error fetching program athlete detail:", error);
    return NextResponse.json({ error: "Failed to fetch athlete details" }, { status: 500 });
  }
}
