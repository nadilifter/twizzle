import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Staff-only route: PARENT-role callers must not be able to fetch another
    // parent's profile, contacts, billing addresses, or athletes by id. Gate on
    // the families.view permission so access stays scoped to roles explicitly
    // granted family access (rather than every non-PARENT role); superadmins
    // carry the "*" permission and pass.
    if (!hasPermission(session.user.permissions, PERMISSIONS.FAMILIES_VIEW)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const organizationId = session.user.organizationId;
    const userId = params.id;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        balance: true,
        status: true,
        memberships: {
          where: { organizationId, role: "PARENT" },
          select: { status: true },
          take: 1,
        },
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
        billingAddresses: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
        athleteGuardians: {
          where: {
            athlete: {
              organizationAthletes: { some: { organizationId } },
            },
          },
          include: {
            athlete: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                birthDate: true,
                gender: true,
                organizationAthletes: {
                  where: { organizationId },
                  select: { level: true, status: true },
                },
              },
            },
          },
        },
        userInvoices: {
          where: { organizationId },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            reference: true,
            total: true,
            status: true,
            createdAt: true,
          },
        },
        userPayments: {
          where: {
            invoice: { organizationId },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
            processedAt: true,
          },
        },
      },
    });

    const isParentMember = (user?.memberships?.length ?? 0) > 0;
    const hasAthleteLinks = (user?.athleteGuardians?.length ?? 0) > 0;

    if (!user || (!hasAthleteLinks && !isParentMember)) {
      return NextResponse.json({ error: "Guardian not found" }, { status: 404 });
    }

    const { memberships, ...rest } = user;

    return NextResponse.json({
      ...rest,
      memberStatus: memberships[0]?.status ?? null,
      athletes: user.athleteGuardians.map((ag) => {
        const { organizationAthletes, ...athleteRest } = ag.athlete;
        const orgAthlete = organizationAthletes[0];
        return {
          ...athleteRest,
          level: orgAthlete?.level ?? "Unassigned",
          status: orgAthlete?.status ?? "ACTIVE",
          isPrimary: ag.isPrimary,
          relationship: ag.relationship,
        };
      }),
    });
  } catch (error) {
    logger.exception("Error fetching guardian:", error as Error);
    return NextResponse.json({ error: "Failed to fetch guardian" }, { status: 500 });
  }
}
