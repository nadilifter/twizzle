import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createRegistrationSchema = z.object({
  athleteId: z.string(),
  familyId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  status: z.enum(["REGISTERED", "WAITLISTED", "CANCELLED"]).default("REGISTERED"),
});

const bulkCreateSchema = z.object({
  registrations: z.array(z.object({
    athleteId: z.string(),
    familyId: z.string().optional().nullable(),
    userId: z.string().optional().nullable(),
    status: z.enum(["REGISTERED", "WAITLISTED", "CANCELLED"]).default("REGISTERED"),
  })),
});

// GET /api/programs/[id]/instances/[instanceId]/registrations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: programId, instanceId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // Verify instance exists and belongs to organization
    const instance = await db.programInstance.findFirst({
      where: {
        id: instanceId,
        programId,
        organizationId: session.user.organizationId,
      },
    });

    if (!instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    const where: any = { programInstanceId: instanceId };
    if (status) {
      where.status = status;
    }

    const registrations = await db.instanceRegistration.findMany({
      where,
      include: {
        athlete: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            level: true,
            dateOfBirth: true,
          },
        },
        family: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(registrations);
  } catch (error) {
    console.error("Error fetching registrations:", error);
    return NextResponse.json(
      { error: "Failed to fetch registrations" },
      { status: 500 }
    );
  }
}

// POST /api/programs/[id]/instances/[instanceId]/registrations
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("registrations.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: programId, instanceId } = await params;
    const body = await request.json();

    // Verify instance exists and belongs to organization
    const instance = await db.programInstance.findFirst({
      where: {
        id: instanceId,
        programId,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: { select: { registrations: true } },
      },
    });

    if (!instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    // Check if bulk or single registration
    if (body.registrations) {
      // Bulk registration
      const validated = bulkCreateSchema.parse(body);

      // Check for existing registrations
      const existingAthleteIds = await db.instanceRegistration.findMany({
        where: {
          programInstanceId: instanceId,
          athleteId: { in: validated.registrations.map(r => r.athleteId) },
        },
        select: { athleteId: true },
      });

      const existingSet = new Set(existingAthleteIds.map(e => e.athleteId));
      const newRegistrations = validated.registrations.filter(
        r => !existingSet.has(r.athleteId)
      );

      if (newRegistrations.length === 0) {
        return NextResponse.json(
          { error: "All athletes are already registered" },
          { status: 400 }
        );
      }

      // Check capacity
      const currentCount = instance._count.registrations;
      if (instance.capacity && currentCount + newRegistrations.length > instance.capacity) {
        // Add excess to waitlist
        const availableSpots = Math.max(0, instance.capacity - currentCount);
        const toRegister = newRegistrations.slice(0, availableSpots);
        const toWaitlist = newRegistrations.slice(availableSpots);

        const sessionUserId = session.user.id;
        const result = await db.instanceRegistration.createMany({
          data: [
            ...toRegister.map(r => ({
              programInstanceId: instanceId,
              athleteId: r.athleteId,
              familyId: r.familyId ?? undefined,
              userId: r.userId ?? sessionUserId,
              status: "REGISTERED" as const,
            })),
            ...toWaitlist.map(r => ({
              programInstanceId: instanceId,
              athleteId: r.athleteId,
              familyId: r.familyId ?? undefined,
              userId: r.userId ?? sessionUserId,
              status: "WAITLISTED" as const,
            })),
          ],
        });

        return NextResponse.json({
          message: `Registered ${toRegister.length}, waitlisted ${toWaitlist.length}`,
          registered: toRegister.length,
          waitlisted: toWaitlist.length,
          count: result.count,
        }, { status: 201 });
      }

      const sessionUserId = session.user.id;
      const result = await db.instanceRegistration.createMany({
        data: newRegistrations.map(r => ({
          programInstanceId: instanceId,
          athleteId: r.athleteId,
          familyId: r.familyId ?? undefined,
          userId: r.userId ?? sessionUserId,
          status: r.status,
        })),
      });

      return NextResponse.json({
        message: `Created ${result.count} registrations`,
        count: result.count,
      }, { status: 201 });
    } else {
      // Single registration
      const validated = createRegistrationSchema.parse(body);

      // Check if already registered
      const existing = await db.instanceRegistration.findFirst({
        where: {
          programInstanceId: instanceId,
          athleteId: validated.athleteId,
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Athlete is already registered for this instance" },
          { status: 400 }
        );
      }

      // Determine status based on capacity
      let status = validated.status;
      if (instance.capacity) {
        const currentCount = instance._count.registrations;
        if (currentCount >= instance.capacity && status === "REGISTERED") {
          status = "WAITLISTED";
        }
      }

      const registration = await db.instanceRegistration.create({
        data: {
          programInstanceId: instanceId,
          athleteId: validated.athleteId,
          familyId: validated.familyId ?? undefined,
          userId: validated.userId ?? session.user.id,
          status,
        },
        include: {
          athlete: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          family: {
            select: { id: true, name: true },
          },
        },
      });

      return NextResponse.json(registration, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating registration:", error);
    return NextResponse.json(
      { error: "Failed to create registration" },
      { status: 500 }
    );
  }
}
