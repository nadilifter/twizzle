import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";
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
        guardians: {
          some: {
            family: {
              organizationId: session.user.organizationId,
            },
          },
        },
      },
      include: {
        guardians: {
          include: {
            family: {
              include: {
                paymentMethods: true,
              },
            },
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

    // Transform for frontend
    const primaryGuardian = athlete.guardians.find((g) => g.isPrimary) || athlete.guardians[0];
    const family = primaryGuardian?.family || { id: "", name: "Unknown", email: "", primaryContact: "Unknown", phone: "", address: null, balance: 0, paymentMethods: [] };

    return NextResponse.json({
      ...athlete,
      family,
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
        guardians: {
          some: {
            family: {
              organizationId: session.user.organizationId,
            },
          },
        },
      },
      include: {
        guardians: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // If changing family, verify new family belongs to org and update guardians
    if (validatedData.familyId) {
      const family = await db.family.findFirst({
        where: {
          id: validatedData.familyId,
          organizationId: session.user.organizationId,
        },
      });
      if (!family) {
        return NextResponse.json({ error: "Family not found" }, { status: 404 });
      }

      // Check if this family is already a guardian
      const existingGuardian = existing.guardians.find(g => g.familyId === validatedData.familyId);
      
      if (existingGuardian) {
        // Set as primary, unset others
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
        // Update the current primary to the new family (replace it)
        // Or add as new primary?
        // "Edit Athlete" usually means correcting the record.
        // If we want to ADD a family, we should probably have a separate UI.
        // For now, let's assume we are replacing the primary guardian link.
        const currentPrimary = existing.guardians.find(g => g.isPrimary) || existing.guardians[0];
        if (currentPrimary) {
           await db.athleteGuardian.update({
             where: { id: currentPrimary.id },
             data: { familyId: validatedData.familyId },
           });
        } else {
           // Create new if none exists
           await db.athleteGuardian.create({
             data: {
               athleteId: id,
               familyId: validatedData.familyId,
               isPrimary: true,
               relationship: "Primary",
             }
           });
        }
      }
    }

    // Handle birthDate separately to use noon UTC for date-only fields
    const { birthDate, familyId, ...otherData } = validatedData;
    const athlete = await db.athlete.update({
      where: { id },
      data: {
        ...otherData,
        // Only update birthDate if explicitly provided (null to clear, string to set)
        ...(birthDate !== undefined && {
          birthDate: birthDate === null ? null : parseDateOnly(birthDate),
        }),
      },
      include: {
        guardians: {
          include: {
            family: true,
          },
        },
        enrollments: {
          include: {
            program: true,
          },
        },
      },
    });

    // Transform for frontend
    const primaryGuardian = athlete.guardians.find((g) => g.isPrimary) || athlete.guardians[0];
    const family = primaryGuardian?.family || { id: "", name: "Unknown", email: "", primaryContact: "Unknown" };

    return NextResponse.json({
      ...athlete,
      family,
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
        guardians: {
          some: {
            family: {
              organizationId: session.user.organizationId,
            },
          },
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
