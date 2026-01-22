import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateAthleteSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  level: z.string().min(1).optional(),
  group: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "TRIAL", "GRADUATED"]).optional(),
  birthDate: z.string().optional().nullable(),
  familyId: z.string().optional(),
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
        family: {
          organizationId: session.user.organizationId,
        },
      },
      include: {
        family: {
          include: {
            paymentMethods: true,
          },
        },
        enrollments: {
          include: {
            program: true,
            membershipTier: true,
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

    return NextResponse.json(athlete);
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

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("athletes.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateAthleteSchema.parse(body);

    const existing = await db.athlete.findFirst({
      where: {
        id,
        family: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // If changing family, verify new family belongs to org
    if (validatedData.familyId && validatedData.familyId !== existing.familyId) {
      const family = await db.family.findFirst({
        where: {
          id: validatedData.familyId,
          organizationId: session.user.organizationId,
        },
      });
      if (!family) {
        return NextResponse.json({ error: "Family not found" }, { status: 404 });
      }
    }

    const athlete = await db.athlete.update({
      where: { id },
      data: {
        ...validatedData,
        birthDate: validatedData.birthDate ? new Date(validatedData.birthDate) : undefined,
      },
      include: {
        family: true,
        enrollments: {
          include: {
            program: true,
          },
        },
      },
    });

    return NextResponse.json(athlete);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
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

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("athletes.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.athlete.findFirst({
      where: {
        id,
        family: {
          organizationId: session.user.organizationId,
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
