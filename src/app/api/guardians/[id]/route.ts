import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
                name: true,
                firstName: true,
                lastName: true,
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

    if (!user) {
      return NextResponse.json({ error: "Guardian not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...user,
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
    console.error("Error fetching guardian:", error);
    return NextResponse.json(
      { error: "Failed to fetch guardian" },
      { status: 500 }
    );
  }
}
