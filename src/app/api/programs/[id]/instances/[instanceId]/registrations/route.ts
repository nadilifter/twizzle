import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const createRegistrationSchema = z.object({
  athleteId: z.string(),
  userId: z.string().optional().nullable(),
  status: z.enum(["REGISTERED", "WAITLISTED", "CANCELLED"]).default("REGISTERED"),
});

const bulkCreateSchema = z.object({
  registrations: z.array(
    z.object({
      athleteId: z.string(),
      userId: z.string().optional().nullable(),
      status: z.enum(["REGISTERED", "WAITLISTED", "CANCELLED"]).default("REGISTERED"),
    })
  ),
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
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            birthDate: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(registrations);
  } catch (error) {
    console.error("Error fetching registrations:", error);
    return NextResponse.json({ error: "Failed to fetch registrations" }, { status: 500 });
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

    const instance = await db.programInstance.findFirst({
      where: {
        id: instanceId,
        programId,
        organizationId: session.user.organizationId,
      },
      select: { id: true, capacity: true },
    });

    if (!instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    if (body.registrations) {
      const validated = bulkCreateSchema.parse(body);

      const result = await db.$transaction(async (tx) => {
        // Lock the instance row to serialize capacity checks
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "ProgramInstance" WHERE id = ${instanceId} FOR UPDATE`
        );

        const existingAthleteIds = await tx.instanceRegistration.findMany({
          where: {
            programInstanceId: instanceId,
            athleteId: { in: validated.registrations.map((r) => r.athleteId) },
          },
          select: { athleteId: true },
        });

        const existingSet = new Set(existingAthleteIds.map((e) => e.athleteId));
        const newRegistrations = validated.registrations.filter(
          (r) => !existingSet.has(r.athleteId)
        );

        if (newRegistrations.length === 0) {
          return { error: "All athletes are already registered" } as const;
        }

        const currentCount = await tx.instanceRegistration.count({
          where: { programInstanceId: instanceId, status: "REGISTERED" },
        });

        if (instance.capacity && currentCount + newRegistrations.length > instance.capacity) {
          const availableSpots = Math.max(0, instance.capacity - currentCount);
          const toRegister = newRegistrations.slice(0, availableSpots);
          const toWaitlist = newRegistrations.slice(availableSpots);

          const sessionUserId = session.user.id;
          const created = await tx.instanceRegistration.createMany({
            data: [
              ...toRegister.map((r) => ({
                programInstanceId: instanceId,
                athleteId: r.athleteId,
                userId: r.userId ?? sessionUserId,
                status: "REGISTERED" as const,
              })),
              ...toWaitlist.map((r) => ({
                programInstanceId: instanceId,
                athleteId: r.athleteId,
                userId: r.userId ?? sessionUserId,
                status: "WAITLISTED" as const,
              })),
            ],
          });

          return {
            message: `Registered ${toRegister.length}, waitlisted ${toWaitlist.length}`,
            registered: toRegister.length,
            waitlisted: toWaitlist.length,
            count: created.count,
          };
        }

        const sessionUserId = session.user.id;
        const created = await tx.instanceRegistration.createMany({
          data: newRegistrations.map((r) => ({
            programInstanceId: instanceId,
            athleteId: r.athleteId,
            userId: r.userId ?? sessionUserId,
            status: r.status,
          })),
        });

        return {
          message: `Created ${created.count} registrations`,
          count: created.count,
        };
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result, { status: 201 });
    } else {
      const validated = createRegistrationSchema.parse(body);

      const result = await db.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "ProgramInstance" WHERE id = ${instanceId} FOR UPDATE`
        );

        const existing = await tx.instanceRegistration.findFirst({
          where: {
            programInstanceId: instanceId,
            athleteId: validated.athleteId,
          },
        });

        if (existing) {
          return { error: "Athlete is already registered for this instance" } as const;
        }

        let status = validated.status;
        if (instance.capacity) {
          const currentCount = await tx.instanceRegistration.count({
            where: { programInstanceId: instanceId, status: "REGISTERED" },
          });
          if (currentCount >= instance.capacity && status === "REGISTERED") {
            status = "WAITLISTED";
          }
        }

        return tx.instanceRegistration.create({
          data: {
            programInstanceId: instanceId,
            athleteId: validated.athleteId,
            userId: validated.userId ?? session.user.id,
            status,
          },
          include: {
            athlete: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
          },
        });
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating registration:", error);
    return NextResponse.json({ error: "Failed to create registration" }, { status: 500 });
  }
}
